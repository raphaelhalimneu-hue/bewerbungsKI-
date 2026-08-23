import { Router } from "express";
import { randomInt } from "crypto";
import { db, pool, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { sendVerificationEmail } from "../lib/email";

const router = Router();

/** POST /verify/send — email a 6-digit code (60s resend cooldown, 15min validity). */
router.post("/verify/send", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const email = req.userEmail || "";
    let [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
    if (!profile) {
      [profile] = await db.insert(profilesTable).values({ userId, email }).returning();
    }
    if (profile.emailVerifiedAt) {
      res.json({ verified: true });
      return;
    }
    const code = String(randomInt(100000, 1000000));
    // Atomic upsert: the 60s cooldown is enforced in the same statement, so
    // concurrent sends cannot bypass it (only one wins the conditional update).
    const upsert = await pool.query(
      `INSERT INTO email_codes (user_id, code, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, now() + interval '15 minutes', 0, now())
       ON CONFLICT (user_id) DO UPDATE
         SET code = $2, expires_at = now() + interval '15 minutes', attempts = 0, last_sent_at = now()
         WHERE email_codes.last_sent_at < now() - interval '60 seconds'
       RETURNING user_id`,
      [userId, code],
    );
    if (!upsert.rowCount) {
      res.status(429).json({ error: "resend_too_soon" });
      return;
    }
    const lang = typeof req.body?.lang === "string" ? req.body.lang.slice(0, 5) : "de";
    await sendVerificationEmail(email, code, lang);
    res.json({ sent: true });
  } catch (err) {
    req.log.error({ err }, "POST /verify/send error");
    res.status(500).json({ error: "send_failed" });
  }
});

/** POST /verify/confirm — check the code and mark the account verified. */
router.post("/verify/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    // Atomically reserve one attempt (max 10) — concurrent guesses each consume
    // an attempt, so brute-forcing beyond the cap is impossible.
    const row = await pool.query(
      `UPDATE email_codes SET attempts = attempts + 1
       WHERE user_id = $1 AND attempts < 10 AND expires_at > now()
       RETURNING code`,
      [userId],
    );
    if (!row.rowCount) {
      const any = await pool.query(`SELECT attempts FROM email_codes WHERE user_id = $1`, [userId]);
      res.status(any.rowCount && any.rows[0].attempts >= 10 ? 429 : 400).json({
        error: any.rowCount ? (any.rows[0].attempts >= 10 ? "too_many_attempts" : "code_expired") : "no_code",
      });
      return;
    }
    if (row.rows[0].code !== code) {
      res.status(400).json({ error: "wrong_code" });
      return;
    }
    const verified = await db
      .update(profilesTable)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning({ userId: profilesTable.userId });
    if (!verified.length) {
      res.status(404).json({ error: "profile_not_found" });
      return;
    }
    await pool.query(`DELETE FROM email_codes WHERE user_id = $1`, [userId]);
    res.json({ verified: true });
  } catch (err) {
    req.log.error({ err }, "POST /verify/confirm error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
