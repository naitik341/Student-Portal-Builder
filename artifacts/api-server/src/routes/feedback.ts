import { Router, type IRouter } from "express";
import { db, feedback } from "@workspace/db";
import { and, count, desc, eq, isNotNull, lt, or } from "drizzle-orm";
import { ListDeliveredFeedbackResponse, ListFeedbackDatesResponse, SubmitFeedbackBody, SubmitFeedbackResponse } from "@workspace/api-zod";
import type { RequestHandler } from "express";
import { requireManager } from "../middlewares/managerAuth";
import { decodeFeedbackCursor, encodeFeedbackCursor } from "./feedbackCursor";

const router: IRouter = Router();
const feedbackLimitWindowMs = 60_000;
const feedbackLimitRequests = 30;
const feedbackRequestWindows = new Map<string, { startedAt: number; count: number }>();

const rateLimitFeedback: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || "unknown";
  let window = feedbackRequestWindows.get(key);

  if (feedbackRequestWindows.size >= 10_000) {
    for (const [address, currentWindow] of feedbackRequestWindows) {
      if (now - currentWindow.startedAt >= feedbackLimitWindowMs) {
        feedbackRequestWindows.delete(address);
      }
    }
    if (!feedbackRequestWindows.has(key) && feedbackRequestWindows.size >= 10_000) {
      res.status(429).json({ error: "Too many feedback submissions" });
      return;
    }
  }

  if (!window || now - window.startedAt >= feedbackLimitWindowMs) {
    window = { startedAt: now, count: 0 };
    feedbackRequestWindows.set(key, window);
  }

  window.count += 1;
  feedbackRequestWindows.set(key, window);
  if (window.count > feedbackLimitRequests) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil((window.startedAt + feedbackLimitWindowMs - now) / 1000)),
    );
    res.status(429).json({ error: "Too many feedback submissions" });
    return;
  }
  next();
};

router.get("/feedback/manage/dates", requireManager, async (req, res, next): Promise<void> => {
  const { meal } = req.query;
  if (meal !== "Breakfast" && meal !== "Lunch" && meal !== "Dinner") {
    res.status(400).json({ error: "Invalid meal" });
    return;
  }

  try {
    const rows = await db.select({
      date: feedback.mealDate,
      count: count(),
    }).from(feedback)
      .where(and(eq(feedback.meal, meal), isNotNull(feedback.mealDate)))
      .groupBy(feedback.mealDate)
      .orderBy(desc(feedback.mealDate));
    res.json(ListFeedbackDatesResponse.parse(rows));
  } catch (error) {
    next(error);
  }
});

router.get("/feedback/manage", requireManager, async (req, res, next) => {
  const { date, meal, cursor } = req.query;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
      (meal !== "Breakfast" && meal !== "Lunch" && meal !== "Dinner") ||
      (cursor !== undefined && (typeof cursor !== "string" || !cursor))) {
    res.status(400).json({ error: "Invalid date or meal" });
    return;
  }

  try {
    const position = cursor ? decodeFeedbackCursor(cursor, date, meal) : null;
    if (cursor && !position) {
      res.status(400).json({ error: "Invalid feedback cursor" });
      return;
    }
    const rows = await db.select({
      id: feedback.id,
      items: feedback.items,
      rating: feedback.rating,
      tags: feedback.tags,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
    }).from(feedback)
      .where(and(
        eq(feedback.mealDate, date),
        eq(feedback.meal, meal),
        position ? or(
          lt(feedback.createdAt, position.createdAt),
          and(eq(feedback.createdAt, position.createdAt), lt(feedback.id, position.id)),
        ) : undefined,
      ))
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(26);
    const page = rows.slice(0, 25);
    const last = page.at(-1);
    res.json(ListDeliveredFeedbackResponse.parse({
      items: page.map(({ id: _id, ...row }) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > 25 && last ? encodeFeedbackCursor({
        date, meal, createdAt: last.createdAt.toISOString(), id: last.id,
      }) : null,
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/feedback", rateLimitFeedback, async (req, res, next) => {
  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback" });
    return;
  }
  try {
    const payload = parsed.data;
    const date = new Date(`${payload.mealDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== payload.mealDate ||
        Number.isNaN(payload.createdAt.getTime()) ||
        payload.items.some((item) => !item.trim() || item.length > 100) ||
        payload.items.length > 30 ||
        payload.tags.length > 50 || payload.tags.some((tag) => !tag.trim() || tag.length > 100)) {
      res.status(400).json({ error: "Invalid feedback" });
      return;
    }
    const [created] = await db
      .insert(feedback)
      .values({
        ...payload,
        createdAt: payload.createdAt,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      res.status(201).json(SubmitFeedbackResponse.parse({
        clientSubmissionId: created.clientSubmissionId,
        createdAt: created.createdAt.toISOString(),
        duplicate: false,
      }));
      return;
    }

    const [existing] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.clientSubmissionId, payload.clientSubmissionId))
      .limit(1);
    if (!existing || existing.deviceId !== payload.deviceId ||
        existing.mealDate !== payload.mealDate || existing.meal !== payload.meal ||
        existing.rating !== payload.rating || existing.comment !== payload.comment ||
        existing.createdAt.toISOString() !== payload.createdAt.toISOString() ||
        JSON.stringify(existing.items) !== JSON.stringify(payload.items) ||
        JSON.stringify(existing.tags) !== JSON.stringify(payload.tags)) {
      res.status(409).json({ error: "Feedback already exists for this device, meal, and day" });
      return;
    }
    res.json(SubmitFeedbackResponse.parse({
      clientSubmissionId: existing.clientSubmissionId,
      createdAt: existing.createdAt.toISOString(),
      duplicate: true,
    }));
  } catch (error) {
    next(error);
  }
});

export default router;