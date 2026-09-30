import { Router, type IRouter } from "express";
import { db, feedback, meals } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
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

const feedbackSchema = z.object({
  clientSubmissionId: z.string().trim().min(1).max(128),
  meal: z.enum(meals),
  items: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(100)).max(50),
  comment: z.string().max(2000),
  createdAt: z.string().datetime({ offset: true }),
});

router.post("/feedback", rateLimitFeedback, async (req, res, next) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback", details: parsed.error.flatten() });
    return;
  }
  try {
    const payload = parsed.data;
    const [created] = await db
      .insert(feedback)
      .values({
        ...payload,
        createdAt: new Date(payload.createdAt),
      })
      .onConflictDoNothing({ target: feedback.clientSubmissionId })
      .returning();
    if (created) {
      res.status(201).json({
        clientSubmissionId: created.clientSubmissionId,
        createdAt: created.createdAt.toISOString(),
        duplicate: false,
      });
      return;
    }

    const [existing] = await db
      .select({
        clientSubmissionId: feedback.clientSubmissionId,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(eq(feedback.clientSubmissionId, payload.clientSubmissionId))
      .limit(1);
    if (!existing) {
      res.status(409).json({ error: "Could not confirm duplicate feedback submission" });
      return;
    }
    res.json({
      clientSubmissionId: existing.clientSubmissionId,
      createdAt: existing.createdAt.toISOString(),
      duplicate: true,
    });
  } catch (error) {
    next(error);
  }
});

export default router;