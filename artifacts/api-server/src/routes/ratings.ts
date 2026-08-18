import { Router, type IRouter } from "express";
import { db, appRatingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

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
