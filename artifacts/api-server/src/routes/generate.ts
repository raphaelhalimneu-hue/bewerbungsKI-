import { Router } from "express";
import { db, profilesTable, documentsTable } from "@workspace/db";
import { and, count, eq, gte } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Silent fair-use limit for Power (unlimited) users: 10 generations/day.
const genUsage = new Map<string, { day: string; n: number }>();
function checkDailyGenQuota(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  let u = genUsage.get(userId);
  if (!u || u.day !== day) { u = { day, n: 0 }; genUsage.set(userId, u); }
  if (u.n >= 10) return false;
  u.n++;
  if (genUsage.size > 10000) genUsage.clear();
  return true;
}

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

    const [{ value }] = await db
      .select({ value: count() })
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId));
    const credits = profile?.credits ?? 0;
    const unlimited = (process.env.UNLIMITED_EMAILS || "halimraphael9@gmail.com").toLowerCase().split(",").includes((req.userEmail || "").toLowerCase());
    if (!unlimited && !profile?.emailVerifiedAt) {
      // New signups must confirm their email address before generating
      res.status(403).json({ error: "email_unverified" });
      return;
    }
    if (profile?.isUnlimited && !unlimited) {
      // Power package: unlimited applications, but a silent fair-use cap of
      // 10 new generations per day protects the AI budget from abuse.
      // Durable part: documents actually saved today (survives restarts);
      // the in-memory counter additionally covers generate-without-save.
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const [{ value: todayCount }] = await db
        .select({ value: count() })
        .from(documentsTable)
        .where(and(eq(documentsTable.userId, userId), gte(documentsTable.createdAt, todayStart)));
      if (Number(todayCount) >= 10 || !checkDailyGenQuota(userId)) {
        res.status(429).json({ error: "daily_limit_reached" });
        return;
      }
    } else if (!unlimited && (credits > 0 || profile?.isPremium)) {
      const limit = 1 + credits; // buyers: 10 per purchased package
      if (value >= limit) {
        res.status(403).json({ error: "premium_limit_reached" });
        return;
      }
    } else if (!unlimited) {
      // Free accounts: unlimited creation on screen (policy 2026-08-19) with a
      // silent daily fair-use cap protecting the AI budget; downloads/prints
      // stay paid.
      if (!checkDailyGenQuota(userId)) {
        res.status(429).json({ error: "daily_limit_reached" });
        return;
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI generation not configured. Please set ANTHROPIC_API_KEY." });
      return;
    }

    const callClaude = () =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

    let response = await callClaude();

    // Bei Rate-Limit oder Überlastung: kurz warten und einmal erneut versuchen
    if (response.status === 429 || response.status === 529) {
      const retryAfter = parseFloat(response.headers.get("retry-after") || "");
      const waitSec = Math.min(Number.isFinite(retryAfter) ? retryAfter + 1 : 15, 40);
      req.log.warn({ waitSec }, "Claude rate limit/overloaded, retrying once");
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      response = await callClaude();
    }

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Claude API error");
      if (response.status === 429 || response.status === 529) {
        res.status(503).json({ error: "busy_try_again" });
        return;
      }
      res.status(500).json({ error: "Generation failed" });
      return;
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    let result = data.content?.find((b) => b.type === "text")?.text ?? "";
    // Strip Markdown code fences the model sometimes emits despite instructions
    result = result
      .replace(/^```(?:html|xml)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    res.json({ result });
  } catch (err) {
    req.log.error({ err }, "POST /generate error");
    res.status(500).json({ error: "Generation failed" });
  }
});

export default router;
