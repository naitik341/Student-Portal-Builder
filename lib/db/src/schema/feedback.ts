import { date, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Retain older feedback data; new submissions use the staff-facing feedback table.
export const feedbackTable = pgTable("meal_feedback", {
  submissionId: text("submission_id").primaryKey(),
  deviceId: text("device_id").notNull(),
  meal: text("meal").notNull(),
  mealDate: date("meal_date", { mode: "string" }).notNull(),
  rating: integer("rating").notNull(),
  tags: text("tags").array().notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("meal_feedback_device_meal_day_unique").on(table.deviceId, table.meal, table.mealDate),
]);

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ deliveredAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;