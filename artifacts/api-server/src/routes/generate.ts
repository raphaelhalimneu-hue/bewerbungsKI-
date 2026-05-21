import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

router.post("/generate", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const { type, systemPrompt, userPrompt } = req.body as {
      type: "cv" | "letter";
      systemPrompt: string;
      userPrompt: string;
    };

    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId));

    if (!profile?.isPremium) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(documentsTable)
        .where(eq(documentsTable.userId, userId));
      if (value >= 1) {
        res.status(403).json({ error: "free_limit_reached" });
        return;
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI generation not configured. Please set ANTHROPIC_API_KEY." });
      return;
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const result = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    res.json({ result });
  } catch (err) {
    req.log.error({ err }, "POST /generate error");
    res.status(500).json({ error: "Generation failed" });
  }
});

export default router;
