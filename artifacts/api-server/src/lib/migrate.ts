import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent startup migrations so schema changes ship with every deploy
 * (dev and production use separate databases; drizzle push only runs in dev).
 */
export async function runStartupMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS generation_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      batch_id text NOT NULL,
      type text NOT NULL,
      full_text text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS generation_results_user_batch_idx
    ON generation_results (user_id, batch_id)
  `);
  // Perfected document copies are retained for existing documents.
  await pool.query(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_letter text`,
  );
  await pool.query(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_cv_html text`,
  );
  await pool.query(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS perfected_generation_id uuid`,
  );
  await pool.query(
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS bezahlt boolean NOT NULL DEFAULT false`,
  );

  // Server-owned perfected text. Free clients receive only preview_text;
  // full_text is released only after the account purchase is verified.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS perfected_generations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL,
      document_id uuid,
      document_type text NOT NULL,
      full_text text NOT NULL,
      preview_text text NOT NULL,
      full_profile text,
      preview_profile text,
      changes jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS perfected_generations_user_created_idx
     ON perfected_generations (user_id, created_at DESC)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS perfected_generations_document_created_idx
     ON perfected_generations (document_id, created_at DESC)`,
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
    `CREATE TABLE IF NOT EXISTS export_counters (
      user_id text NOT NULL,
      doc_id text NOT NULL,
      kind text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, doc_id, kind)
    )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS email_codes (
      user_id text PRIMARY KEY,
      code text NOT NULL,
      expires_at timestamp NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      last_sent_at timestamp NOT NULL DEFAULT now()
    )`,
  );

  // Power-Plan daily rolling counters (DB-backed to survive restarts and scale
  // across multiple API instances; reset automatically when the date changes).
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_perfect_count integer NOT NULL DEFAULT 0`,
  );
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_perfect_date text`,
  );
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_doc_count integer NOT NULL DEFAULT 0`,
  );
  await pool.query(
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_doc_date text`,
  );
}
