import { Router, type IRouter } from "express";
import { db, appRatingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// Historic baseline shown before in-app ratings existed
const BASE_COUNT = 253;
const BASE_AVG = 4.9;
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

// Public aggregate: baseline (253 × 4.9) combined with real in-app ratings
router.get("/ratings/summary", async (req, res) => {
  try {
    const [r] = await db
      .select({
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${appRatingsTable.stars}), 0)::int`,
      })
      .from(appRatingsTable);
    const count = BASE_COUNT + (r?.count || 0);
    const avg = (BASE_COUNT * BASE_AVG + (r?.sum || 0)) / count;
    res.json({ count, avg: Math.round(avg * 10) / 10 });
  } catch (err) {
    req.log.error({ err }, "GET /ratings/summary error");
    res.status(500).json({ error: "Server error" });
  }
});

// The user's own rating (used to prefill / hide the rating card)
router.get("/ratings/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [rating] = await db
      .select()
      .from(appRatingsTable)
      .where(eq(appRatingsTable.userId, req.userId!));
    res.json(rating || null);
  } catch (err) {
    req.log.error({ err }, "GET /ratings/me error");
    res.status(500).json({ error: "Server error" });
  }
});

// Create or update the user's rating (stars 1-5, optional comment)
router.post("/ratings", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { stars, comment } = req.body || {};
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      res.status(400).json({ error: "stars must be an integer between 1 and 5" });
      return;
    }
    if (comment !== undefined && comment !== null && typeof comment !== "string") {
      res.status(400).json({ error: "comment must be a string" });
      return;
    }
    const cleanComment = typeof comment === "string" ? comment.slice(0, 2000) : null;
    await db
      .insert(appRatingsTable)
      .values({ userId: req.userId!, stars, comment: cleanComment })
      .onConflictDoUpdate({
        target: appRatingsTable.userId,
        set: { stars, comment: cleanComment, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /ratings error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
