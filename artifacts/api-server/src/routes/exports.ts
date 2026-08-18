import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isFreeAccount, consumeExportQuota, getExportCounts, EXPORT_KINDS, FREE_EXPORT_LIMIT, type ExportKind } from "../lib/freeLock";

const router = Router();

/**
 * GET /documents/:id/export-counters — how many free exports are used up.
 * Paid accounts always report { free: false } (no limits).
 */
router.get("/documents/:id/export-counters", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!(await isFreeAccount(req.userId!, req.userEmail))) {
      res.json({ free: false, limit: null, counts: {} });
      return;
    }
    const counts = await getExportCounts(req.userId!, req.params.id);
    res.json({ free: true, limit: FREE_EXPORT_LIMIT, counts });
  } catch (e) {
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /documents/:id/export-event { kind } — consume one client-side export
 * (CV PDF is generated in the browser; printing happens in the browser).
 * Free accounts: max 1 per kind per document. Paid accounts: always allowed.
 */
router.post("/documents/:id/export-event", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const kind = (req.body?.kind as ExportKind) || "";
    if (!EXPORT_KINDS.includes(kind)) {
      res.status(400).json({ error: "invalid_kind" });
      return;
    }
    if (!(await isFreeAccount(req.userId!, req.userEmail))) {
      res.json({ allowed: true });
      return;
    }
    // Only count exports of documents the user actually owns
    const [doc] = await db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));
    if (!doc) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const allowed = await consumeExportQuota(req.userId!, req.params.id, kind);
    res.json({ allowed });
  } catch (e) {
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
