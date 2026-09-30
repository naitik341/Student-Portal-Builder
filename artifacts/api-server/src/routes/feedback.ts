import { Router, type IRouter } from "express";
import { db, feedback } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SubmitFeedbackBody, SubmitFeedbackResponse } from "@workspace/api-zod";
import type { RequestHandler } from "express";

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