import { db } from "@workspace/db";
import { menuItems, settings, type Meal } from "@workspace/db";
import { eq } from "drizzle-orm";

const initialItems: Array<{
  name: string;
  isVeg: boolean;
  meals: Meal[];
  sortOrder: number;
}> = [
  { name: "Veg Combo", isVeg: true, meals: ["Lunch", "Dinner"], sortOrder: 0 },
  {
    name: "Chole Platter",
    isVeg: true,
    meals: ["Lunch", "Dinner"],
    sortOrder: 1,
  },
  {
    name: "Egg Fried Rice",
    isVeg: false,
    meals: ["Lunch", "Dinner"],
    sortOrder: 2,
  },
  {
    name: "Normal Roll",
    isVeg: true,
    meals: ["Lunch", "Dinner"],
    sortOrder: 3,
  },
];

export async function seedInitialData(): Promise<void> {
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(settings)
      .values({
        id: 1,
        headingLine1: "WHAT DID YOU",
        headingLine2: "ORDER?",
        menuSeeded: true,
      })
      .onConflictDoNothing()
      .returning({ id: settings.id });

    if (inserted.length) {
      const [existingItem] = await tx
        .select({ id: menuItems.id })
        .from(menuItems)
        .limit(1);
      if (!existingItem) {
        await tx.insert(menuItems).values(initialItems);
      }
      return;
    }

    const [existing] = await tx
      .select({ menuSeeded: settings.menuSeeded })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    if (existing && !existing.menuSeeded) {
      const [existingItem] = await tx.select({ id: menuItems.id }).from(menuItems).limit(1);
      if (!existingItem) {
        await tx.insert(menuItems).values(initialItems);
      }
      await tx
        .update(settings)
        .set({ menuSeeded: true })
        .where(eq(settings.id, 1));
    }
  });
}