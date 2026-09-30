import { Router, type IRouter } from "express";
import { and, asc, eq, max, sql } from "drizzle-orm";
import { db, menuItems, meals, settings, type Meal } from "@workspace/db";
import { z } from "zod";
import { requireManager } from "../middlewares/managerAuth";

const router: IRouter = Router();
const mealSchema = z.enum(meals);
const imageDataSchema = z
  .string()
  .regex(
    /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]*={0,2}$/,
    "imageData must be a base64 WebP, PNG, or JPEG data URL",
  )
  .nullable();
const menuFieldsSchema = z.object({
  name: z.string().trim().min(1).max(20),
  imageData: imageDataSchema,
  isVeg: z.boolean(),
  meals: z.array(mealSchema),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});
const createMenuItemSchema = menuFieldsSchema
  .omit({ sortOrder: true, active: true })
  .extend({
    sortOrder: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  });
const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});
const settingsSchema = z.object({
  headingLine1: z.string().trim().min(1).max(60),
  headingLine2: z.string().trim().min(1).max(60),
});

function itemResponse(item: typeof menuItems.$inferSelect) {
  return {
    id: item.id,
    name: item.name,
    imageData: item.imageData,
    isVeg: item.isVeg,
    meals: item.meals,
    sortOrder: item.sortOrder,
    active: item.active,
  };
}

function validateMealQuery(raw: unknown):
  | { meal?: Meal }
  | { error: string } {
  if (raw === undefined) return {};
  const result = mealSchema.safeParse(raw);
  return result.success ? { meal: result.data } : { error: "Invalid meal" };
}

function bodyImageTooLarge(body: unknown): boolean {
  const value = body as { imageData?: unknown };
  return typeof value?.imageData === "string" && value.imageData.length > 1_800_000;
}

router.get("/menu/manage", requireManager, async (req, res, next) => {
  const mealQuery = validateMealQuery(req.query.meal);
  if ("error" in mealQuery) {
    res.status(400).json({ error: mealQuery.error });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(menuItems)
      .where(
        mealQuery.meal
          ? sql`${menuItems.meals} @> ${JSON.stringify([mealQuery.meal])}::jsonb`
          : undefined,
      )
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    res.json(rows.map(itemResponse));
  } catch (error) {
    next(error);
  }
});

router.get("/menu", async (req, res, next) => {
  const mealQuery = validateMealQuery(req.query.meal);
  if ("error" in mealQuery) {
    res.status(400).json({ error: mealQuery.error });
    return;
  }
  try {
    const mealCondition = mealQuery.meal
      ? sql`${menuItems.meals} @> ${JSON.stringify([mealQuery.meal])}::jsonb`
      : undefined;
    const rows = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.active, true), mealCondition))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    res.json(rows.map(itemResponse));
  } catch (error) {
    next(error);
  }
});

router.post("/menu", requireManager, async (req, res, next) => {
  if (bodyImageTooLarge(req.body)) {
    res.status(413).json({ error: "Image data URL exceeds the 600px image limit" });
    return;
  }
  const parsed = createMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid menu item", details: parsed.error.flatten() });
    return;
  }
  try {
    const { sortOrder, active, ...fields } = parsed.data;
    let resolvedOrder = sortOrder;
    if (resolvedOrder === undefined) {
      const [current] = await db
        .select({ sortOrder: max(menuItems.sortOrder) })
        .from(menuItems);
      resolvedOrder = (current.sortOrder ?? -1) + 1;
    }
    const [created] = await db
      .insert(menuItems)
      .values({ ...fields, sortOrder: resolvedOrder, active: active ?? true })
      .returning();
    res.status(201).json(itemResponse(created));
  } catch (error) {
    next(error);
  }
});

router.post("/menu/reorder", requireManager, async (req, res, next) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (
    !parsed.success ||
    new Set(parsed.data.ids).size !== parsed.data.ids.length
  ) {
    res.status(400).json({ error: "ids must be a unique list of menu item IDs" });
    return;
  }
  try {
    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    const existingIds = existing.map(({ id }) => id);
    if (
      existingIds.length !== parsed.data.ids.length ||
      existingIds.some((id) => !parsed.data.ids.includes(id))
    ) {
      res.status(400).json({ error: "Reorder must include every menu item exactly once" });
      return;
    }
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of parsed.data.ids.entries()) {
        await tx
          .update(menuItems)
          .set({ sortOrder })
          .where(eq(menuItems.id, id));
      }
    });
    const rows = await db
      .select()
      .from(menuItems)
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
    res.json(rows.map(itemResponse));
  } catch (error) {
    next(error);
  }
});

router.put("/menu/:id", requireManager, async (req, res, next) => {
  if (bodyImageTooLarge(req.body)) {
    res.status(413).json({ error: "Image data URL exceeds the 600px image limit" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = menuFieldsSchema.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
    res.status(400).json({
      error: "Invalid menu item update",
      ...(parsed.success ? {} : { details: parsed.error.flatten() }),
    });
    return;
  }
  try {
    const [updated] = await db
      .update(menuItems)
      .set(parsed.data)
      .where(eq(menuItems.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }
    res.json(itemResponse(updated));
  } catch (error) {
    next(error);
  }
});

router.delete("/menu/:id", requireManager, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid menu item ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(menuItems)
      .where(eq(menuItems.id, id))
      .returning({ id: menuItems.id });
    if (!deleted) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/settings", async (_req, res, next) => {
  try {
    const [row] = await db
      .select({
        headingLine1: settings.headingLine1,
        headingLine2: settings.headingLine2,
      })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    res.json(
      row ?? { headingLine1: "WHAT DID YOU", headingLine2: "ORDER?" },
    );
  } catch (error) {
    next(error);
  }
});

router.put("/settings", requireManager, async (req, res, next) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings", details: parsed.error.flatten() });
    return;
  }
  try {
    const [updated] = await db
      .insert(settings)
      .values({ id: 1, ...parsed.data })
      .onConflictDoUpdate({
        target: settings.id,
        set: parsed.data,
      })
      .returning({
        headingLine1: settings.headingLine1,
        headingLine2: settings.headingLine2,
      });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;