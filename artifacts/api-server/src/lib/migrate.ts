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
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_letter text`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_cv_html text`,
  );

  // Idempotency ledger for Stripe webhook events
  await pool.query(
    `CREATE TABLE IF NOT EXISTS stripe_events (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
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
