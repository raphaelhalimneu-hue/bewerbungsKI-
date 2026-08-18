import { db, profilesTable, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

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
