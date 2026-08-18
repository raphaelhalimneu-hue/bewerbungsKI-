import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent startup migrations so schema changes ship with every deploy
 * (dev and production use separate databases; drizzle push only runs in dev).
 */
export async function runStartupMigrations(): Promise<void> {
  // Credits model: limit = 3 free + purchased credits (30 per package)
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0`,
  );

  // Power package (29.90): unlimited applications + 50 lifetime perfect uses
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_unlimited boolean NOT NULL DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS perfect_count integer NOT NULL DEFAULT 0`,
  );

  // Perfected view-only copies for locked free accounts
  await pool.query(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_letter text`,
  );
  await pool.query(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_cv_html text`,
  );

  // In-app ratings (stars 1-5, optional comment, one per user)
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_ratings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL UNIQUE,
      stars integer NOT NULL,
      comment text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
  );

  // Idempotency ledger for Stripe webhook events
  await pool.query(
    `CREATE TABLE IF NOT EXISTS stripe_events (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  );

  // Email verification: new signups must confirm their address via 6-digit code.
  // Existing accounts are grandfathered in (backfilled as verified) exactly once,
  // guarded by a column-existence check so re-runs never re-verify new users.
  // Advisory lock makes check+alter+backfill safe under concurrent starts
  // (rolling deploys): only one instance performs the one-time backfill.
  await pool.query(`SELECT pg_advisory_lock(824601)`);
  try {
    const verCol = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_verified_at'`,
    );
    if (!verCol.rowCount) {
      await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamp`);
      const bf = await pool.query(`UPDATE profiles SET email_verified_at = now()`);
      logger.info({ rows: bf.rowCount }, "Backfilled email_verified_at for existing profiles");
    }
  } finally {
    await pool.query(`SELECT pg_advisory_unlock(824601)`);
  }
  await pool.query(
    `CREATE TABLE IF NOT EXISTS email_codes (
      user_id text PRIMARY KEY,
      code text NOT NULL,
      expires_at timestamp NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      last_sent_at timestamp NOT NULL DEFAULT now()
    )`,
  );

  // Free-tier export limits: one PDF download and one print per document part.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS export_counters (
      user_id text NOT NULL,
      doc_id text NOT NULL,
      kind text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, doc_id, kind)
    )`,
  );

  // Backfill: legacy premium buyers (boolean is_premium, no credits yet) keep
  // their purchased 30-application package. Safe to re-run: after this change,
  // is_premium=true always comes with credits>0, so only legacy rows match.
  const res = await pool.query(
    `UPDATE profiles SET credits = 30 WHERE is_premium = true AND credits = 0`,
  );
  if (res.rowCount) {
    logger.info({ rows: res.rowCount }, "Backfilled credits for legacy premium profiles");
  }
}
