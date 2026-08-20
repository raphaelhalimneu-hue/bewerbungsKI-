import { Router, type IRouter } from "express";
import { db, documentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { consumePrintQuota, getPrintCounts, PRINT_KINDS, FREE_PRINT_LIMIT, type PrintKind } from "../lib/freeLock";

const router: IRouter = Router();

function paramId(v: unknown): string {
  return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
}

// Current print counters for one document (free accounts only)
router.get("/documents/:id/export-counters", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const docId = paramId(req.params.id);
    const [doc] = await db.select({ bezahlt: documentsTable.bezahlt })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, docId), eq(documentsTable.userId, req.userId!)));
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    if (doc.bezahlt) { res.json({ free: false }); return; }
    const counts = await getPrintCounts(req.userId!, docId);
    res.json({ free: true, limit: FREE_PRINT_LIMIT, counts });
  } catch (err) {
    req.log.error({ err }, "GET export-counters error");
    res.status(500).json({ error: "Server error" });
  }
});

// Consume one print. Paid accounts: always allowed, nothing is counted.
router.post("/documents/:id/export-event", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const docId = paramId(req.params.id);
    const kind = req.body?.kind as PrintKind;
    if (!PRINT_KINDS.includes(kind)) {
      res.status(400).json({ error: "invalid kind" });
      return;
    }
    const [doc] = await db
      .select({ id: documentsTable.id, bezahlt: documentsTable.bezahlt })
      .from(documentsTable)
      .where(and(eq(documentsTable.id, docId), eq(documentsTable.userId, req.userId!)));
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (doc.bezahlt) {
      res.json({ allowed: true });
      return;
    }
    const allowed = await consumePrintQuota(req.userId!, docId, kind);
    res.json({ allowed });
  } catch (err) {
    req.log.error({ err }, "POST export-event error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
