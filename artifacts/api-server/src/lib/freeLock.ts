import { db, pool, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export type PrintKind = "cv_print" | "letter_print";
export const PRINT_KINDS: PrintKind[] = ["cv_print", "letter_print"];
/** Free accounts: max 1 print per part (CV / letter) per document. */
export const FREE_PRINT_LIMIT = 1;
const freeApplicationCreateLocks = new Map<string, Promise<void>>();
const UNLIMITED_PROFILE_EMAIL = "halimraphael9@gmail.com";

/** Only the explicitly requested owner profile receives unlimited access. */
export function isUnlimitedEmail(email?: string): boolean {
  return (email || "").trim().toLowerCase() === UNLIMITED_PROFILE_EMAIL;
}

/**
 * Atomically consume one print for a free account. Returns true while the
 * limit is not yet reached (and counts it), false when it is used up.
 */
export async function consumePrintQuota(userId: string, docId: string, kind: PrintKind): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO export_counters (user_id, doc_id, kind, count) VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, doc_id, kind)
     DO UPDATE SET count = export_counters.count + 1 WHERE export_counters.count < $4
     RETURNING count`,
    [userId, docId, kind, FREE_PRINT_LIMIT],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Current print counts for one document (missing kinds = 0). */
export async function getPrintCounts(userId: string, docId: string): Promise<Record<PrintKind, number>> {
  const r = await pool.query(
    `SELECT kind, count FROM export_counters WHERE user_id = $1 AND doc_id = $2`,
    [userId, docId],
  );
  const out: Record<PrintKind, number> = { cv_print: 0, letter_print: 0 };
  for (const row of r.rows) if (row.kind in out) out[row.kind as PrintKind] = row.count;
  return out;
}

/**
 * True when the account has never purchased (no premium, no credits).
 */
export async function isFreeAccount(userId: string, email?: string): Promise<boolean> {
  if (isUnlimitedEmail(email)) return false;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return !(profile?.isPremium || (profile?.credits ?? 0) > 0);
}

/** True when the account still has to confirm its email address (new signups). */
export async function isEmailUnverified(userId: string, email?: string): Promise<boolean> {
  if (isUnlimitedEmail(email)) return false;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return !profile?.emailVerifiedAt;
}

export async function isFreeQuotaLocked(userId: string, email?: string): Promise<boolean> {
  if (isUnlimitedEmail(email)) return false;
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

/**
 * Serializes first-document creation per account. The in-process queue keeps
 * local calls ordered, while PostgreSQL's advisory lock coordinates concurrent
 * API instances. The callback must perform the quota check and insert itself.
 */
export async function withFreeApplicationCreateLock<T>(userId: string, callback: () => Promise<T>): Promise<T> {
  const previous = freeApplicationCreateLocks.get(userId) || Promise.resolve();
  let releaseQueue!: () => void;
  const waitForCurrent = new Promise<void>((resolve) => { releaseQueue = resolve; });
  const queued = previous.then(() => waitForCurrent);
  freeApplicationCreateLocks.set(userId, queued);
  await previous;

  let client: { query: (text: string, values?: unknown[]) => Promise<unknown>; release: () => void } | undefined;
  try {
    if (typeof (pool as any).connect === "function") {
      client = await (pool as any).connect();
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [userId]);
    }
    return await callback();
  } finally {
    try {
      if (client) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [userId]);
    } finally {
      client?.release();
      releaseQueue();
      if (freeApplicationCreateLocks.get(userId) === queued) {
        freeApplicationCreateLocks.delete(userId);
      }
    }
  }
}
