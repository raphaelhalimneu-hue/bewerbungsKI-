import { Router, type IRouter } from "express";
import { db, documentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isFreeAccount, isFreeQuotaLocked, consumePrintQuota, getPrintCounts, PRINT_KINDS, FREE_PRINT_LIMIT, type PrintKind } from "../lib/freeLock";

const router: IRouter = Router();

function paramId(v: unknown): string {
  return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
}

// Current print counters for one document (free accounts only)
router.get("/documents/:id/export-counters", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (await isFreeQuotaLocked(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }
    const docId = paramId(req.params.id);
    if (!(await isFreeAccount(req.userId!, req.userEmail))) {
      res.json({ free: false });
      return;
    }
    // Printing is paid-only since 2026-08-19: free accounts get limit 0.
    const counts = await getPrintCounts(req.userId!, docId);
    res.json({ free: true, limit: 0, counts });
  } catch (err) {
    req.log.error({ err }, "GET export-counters error");
    res.status(500).json({ error: "Server error" });
  }
});

// Consume one print. Paid accounts: always allowed, nothing is counted.
router.post("/documents/:id/export-event", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (await isFreeQuotaLocked(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }
    const docId = paramId(req.params.id);
    const kind = req.body?.kind as PrintKind;
    if (!PRINT_KINDS.includes(kind)) {
      res.status(400).json({ error: "invalid kind" });
      return;
    }
    if (!(await isFreeAccount(req.userId!, req.userEmail))) {
      res.json({ allowed: true });
      return;
    }
    const [doc] = await db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, docId), eq(documentsTable.userId, req.userId!)));
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Printing is paid-only since 2026-08-19: free accounts are never allowed.
    res.json({ allowed: false });
  } catch (err) {
    req.log.error({ err }, "POST export-event error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
