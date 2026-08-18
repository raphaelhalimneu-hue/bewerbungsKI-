import { db, pool, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export type ExportKind = "cv_pdf" | "letter_pdf" | "cv_print" | "letter_print";
export const EXPORT_KINDS: ExportKind[] = ["cv_pdf", "letter_pdf", "cv_print", "letter_print"];
/** Free accounts: max 1 export per kind per document. */
export const FREE_EXPORT_LIMIT = 1;

/**
 * Atomically consume one export (download/print) for a free account.
 * Returns true when the export is still allowed (and counts it),
 * false when the free limit for this kind is already used up.
 */
export async function consumeExportQuota(userId: string, docId: string, kind: ExportKind): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO export_counters (user_id, doc_id, kind, count) VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, doc_id, kind)
     DO UPDATE SET count = export_counters.count + 1 WHERE export_counters.count < $4
     RETURNING count`,
    [userId, docId, kind, FREE_EXPORT_LIMIT],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Current export counts per kind for one document (missing kinds = 0). */
export async function getExportCounts(userId: string, docId: string): Promise<Record<ExportKind, number>> {
  const r = await pool.query(
    `SELECT kind, count FROM export_counters WHERE user_id = $1 AND doc_id = $2`,
    [userId, docId],
  );
  const out: Record<ExportKind, number> = { cv_pdf: 0, letter_pdf: 0, cv_print: 0, letter_print: 0 };
  for (const row of r.rows) if (row.kind in out) out[row.kind as ExportKind] = row.count;
  return out;
}

/**
 * Premium features (Scanner/Analyse, Perfektionieren, Live-Editor-Speichern)
 * are locked for free users once their single free application has been
 * generated. Viewing and downloading existing documents stays free.
 */
/**
 * True when the account has never purchased (no premium, no credits).
 * Free trial users may view and PRINT their application, but saving files
 * (PDF/DOCX downloads) requires a purchase.
 */
export async function isFreeAccount(userId: string, email?: string): Promise<boolean> {
  const unlimited = (process.env.UNLIMITED_EMAILS || "halimraphael9@gmail.com")
    .toLowerCase()
    .split(",")
    .includes((email || "").toLowerCase());
  if (unlimited) return false;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return !(profile?.isPremium || (profile?.credits ?? 0) > 0);
}

/** True when the account still has to confirm its email address (new signups). */
export async function isEmailUnverified(userId: string, email?: string): Promise<boolean> {
  const unlimited = (process.env.UNLIMITED_EMAILS || "halimraphael9@gmail.com")
    .toLowerCase()
    .split(",")
    .includes((email || "").toLowerCase());
  if (unlimited) return false;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return !profile?.emailVerifiedAt;
}

export async function isFreeQuotaLocked(userId: string, email?: string): Promise<boolean> {
  const unlimited = (process.env.UNLIMITED_EMAILS || "halimraphael9@gmail.com")
    .toLowerCase()
    .split(",")
    .includes((email || "").toLowerCase());
  if (unlimited) return false;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  if (profile?.isPremium || (profile?.credits ?? 0) > 0) return false;

  const [{ value }] = await db
    .select({ value: count() })
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId));
  return value >= 1;
}
