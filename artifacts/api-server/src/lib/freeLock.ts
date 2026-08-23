import { db, pool, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

/**
 * Returns true when a free user (no isPremium, no isUnlimited, 0 credits) already
 * owns at least one document. Analyze, perfect, and content-editing endpoints return
 * 403 upgrade_required in that case. Paying users and unlimited accounts are never locked.
 */
export async function isFreeQuotaLocked(userId: string): Promise<boolean> {
  const [profile] = await db
    .select({
      isPremium: profilesTable.isPremium,
      isUnlimited: profilesTable.isUnlimited,
      credits: profilesTable.credits,
    })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));

  // Any form of paid access bypasses the lock.
  if (profile?.isPremium || profile?.isUnlimited || Number(profile?.credits ?? 0) > 0) {
    return false;
  }

  // Count how many documents this user owns.
  const [row] = await db
    .select({ value: count() })
    .from(documentsTable)
    .where(eq(documentsTable.userId, userId));

  return Number(row?.value ?? 0) >= 1;
}

export type PrintKind = "cv_print" | "letter_print";
export const PRINT_KINDS: PrintKind[] = ["cv_print", "letter_print"];
/** All document actions are currently free and unlimited. */
export const FREE_PRINT_LIMIT = Number.MAX_SAFE_INTEGER;
const freeApplicationCreateLocks = new Map<string, Promise<void>>();
/**
 * Exporting is free and does not consume a quota.
 */
export async function consumePrintQuota(userId: string, docId: string, kind: PrintKind): Promise<boolean> {
  void userId; void docId; void kind;
  return true;
}

export async function hasPaidEntitlement(userId: string): Promise<boolean> {
  const [profile] = await db.select({
    isPremium: profilesTable.isPremium,
    isUnlimited: profilesTable.isUnlimited,
    credits: profilesTable.credits,
  }).from(profilesTable).where(eq(profilesTable.userId, userId));
  return !!profile && (!!profile.isPremium || !!profile.isUnlimited || Number(profile.credits ?? 0) > 0);
}

/** Current print counts for one document (missing kinds = 0). */
export async function getPrintCounts(userId: string, docId: string): Promise<Record<PrintKind, number>> {
  void userId; void docId;
  return { cv_print: 0, letter_print: 0 };
}

/** True when the account still has to confirm its email address (new signups). */
export async function isEmailUnverified(userId: string, email?: string): Promise<boolean> {
  void email;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return !profile?.emailVerifiedAt;
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
      const connectedClient = await (pool as any).connect();
      client = connectedClient;
      await connectedClient.query("SELECT pg_advisory_lock(hashtext($1))", [userId]);
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
