import { db, pool, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export type PrintKind = "cv_print" | "letter_print";
export const PRINT_KINDS: PrintKind[] = ["cv_print", "letter_print"];
/** All document actions are currently free and unlimited. */
export const FREE_PRINT_LIMIT = Number.MAX_SAFE_INTEGER;
const freeApplicationCreateLocks = new Map<string, Promise<void>>();
const UNLIMITED_PROFILE_EMAIL = "halimraphael9@gmail.com";

export function isUnlimitedEmail(email?: string): boolean {
  return false;
}

/**
 * Legacy helper kept for compatibility with old profile rows. Access no longer
 * depends on credits, plans, or purchase history.
 */
export function hasPaidEntitlement(profile?: {
  credits?: number | null;
  isUnlimited?: boolean | null;
} | null): boolean {
  void profile;
  return false;
}

/**
 * Exporting is free and does not consume a quota.
 */
export async function consumePrintQuota(userId: string, docId: string, kind: PrintKind): Promise<boolean> {
  void userId; void docId; void kind;
  return true;
}

/** Current print counts for one document (missing kinds = 0). */
export async function getPrintCounts(userId: string, docId: string): Promise<Record<PrintKind, number>> {
  void userId; void docId;
  return { cv_print: 0, letter_print: 0 };
}

/**
 * The app is currently completely free.
 */
export async function isFreeAccount(userId: string, email?: string): Promise<boolean> {
  void userId; void email;
  return false;
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
  void userId; void email;
  return false;
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
