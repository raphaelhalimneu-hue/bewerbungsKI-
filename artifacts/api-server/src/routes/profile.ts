import { Router } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isFreeQuotaLocked } from "../lib/freeLock";

const router = Router();

router.get("/saved-profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (await isFreeQuotaLocked(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }
    const [profile] = await db
      .select({ savedProfile: profilesTable.savedProfile })
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.userId!));

    res.json({ savedProfile: profile?.savedProfile ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /saved-profile error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/saved-profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (await isFreeQuotaLocked(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }
    const { savedProfile } = req.body;
    await db
      .update(profilesTable)
      .set({ savedProfile, updatedAt: new Date() })
      .where(eq(profilesTable.userId, req.userId!));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PUT /saved-profile error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
