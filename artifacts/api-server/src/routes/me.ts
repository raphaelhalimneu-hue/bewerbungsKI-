import { Router } from "express";
import { db, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isUnlimitedEmail } from "../lib/freeLock";

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
    const unlimited = isUnlimitedEmail(req.userEmail);
    const freeApplicationFinished = !unlimited &&
      !profile.isPremium &&
      (profile.credits ?? 0) === 0 &&
      Number(docCount) >= 1;
    res.json({
      email: profile.email,
      is_premium: unlimited || profile.isPremium,
      is_unlimited: unlimited || profile.isUnlimited,
      credits: profile.credits,
      // A free account receives one complete application. Every further app
      // action is purchase-gated; buyers keep their package limit.
      document_limit: unlimited || profile.isUnlimited ? 999999 : freeApplicationFinished ? 0 : (!profile.isPremium && profile.credits === 0) ? 1 : 1 + profile.credits,
      documents_count: Number(docCount) || 0,
      email_verified: unlimited || !!profile.emailVerifiedAt,
    });
  } catch (err) {
    req.log.error({ err }, "GET /me error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
