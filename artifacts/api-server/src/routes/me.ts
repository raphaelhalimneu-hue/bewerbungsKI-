import { Router } from "express";
import { db, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const email = req.userEmail ?? "";

    let [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId));

    if (!profile) {
      [profile] = await db
        .insert(profilesTable)
        .values({ userId, email })
        .returning();
    }

    const [{ value: docCount }] = await db
      .select({ value: count() })
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId));

    res.json({
      email: profile.email,
      is_premium: profile.isPremium,
      credits: profile.credits,
      document_limit: 3 + profile.credits,
      documents_count: Number(docCount) || 0,
    });
  } catch (err) {
    req.log.error({ err }, "GET /me error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
