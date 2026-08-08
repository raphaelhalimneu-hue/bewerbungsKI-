import { Router } from "express";
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI generation not configured. Please set GROQ_API_KEY." });
      return;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Groq API error");
      res.status(500).json({ error: "Generation failed" });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const result = data.choices?.[0]?.message?.content ?? "";
    res.json({ result });
  } catch (err) {
    req.log.error({ err }, "POST /generate error");
    res.status(500).json({ error: "Generation failed" });
  }
});

export default router;
