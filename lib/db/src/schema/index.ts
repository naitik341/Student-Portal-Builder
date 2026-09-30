import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const meals = ["Breakfast", "Lunch", "Dinner"] as const;
export type Meal = (typeof meals)[number];

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageData: text("image_data"),
  isVeg: boolean("is_veg").notNull().default(true),
  meals: jsonb("meals").$type<Meal[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  headingLine1: text("heading_line1").notNull().default("WHAT DID YOU"),
  headingLine2: text("heading_line2").notNull().default("ORDER?"),
  menuSeeded: boolean("menu_seeded").notNull().default(false),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  clientSubmissionId: text("client_submission_id").notNull().unique(),
  meal: text("meal").$type<Meal>().notNull(),
  items: jsonb("items").$type<string[]>().notNull(),
  rating: integer("rating").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});