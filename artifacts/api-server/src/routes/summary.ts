import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireManager } from "../middlewares/managerAuth";

const router: IRouter = Router();

router.get("/summary", requireManager, async (_req, res) => {
  try {
    const grouped = await db.execute<{
      item: string;
      tag: string;
      count: number;
    }>(sql`
      SELECT item.value AS item, tag.value AS tag, COUNT(*)::int AS count
      FROM feedback AS f
      CROSS JOIN LATERAL jsonb_array_elements_text(f.items) AS item(value)
      CROSS JOIN LATERAL jsonb_array_elements_text(f.tags) AS tag(value)
      GROUP BY item.value, tag.value
      ORDER BY item.value, COUNT(*) DESC, tag.value
    `);
    const counts = grouped.rows;
    if (!counts.length) {
      res.json({ summary: "There is not enough tagged feedback to summarize yet.", counts });
      return;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content:
            "Summarize the student feedback tag counts below, grouped by menu item. " +
            "Name each item explicitly, include the tag counts in parentheses, and do not infer beyond these counts.\n\n" +
            JSON.stringify(counts),
        },
      ],
    });
    const summary = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
    if (!summary) {
      res.status(502).json({ error: "The summary provider returned no text" });
      return;
    }
    res.json({ summary, counts });
  } catch (error) {
    res.status(502).json({ error: "Could not generate feedback summary" });
  }
});

export default router;