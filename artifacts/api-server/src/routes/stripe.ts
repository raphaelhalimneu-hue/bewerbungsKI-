import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db, profilesTable, stripeEventsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
// Railway's production environment previously contained only the Stripe
// credentials. Keep the approved live price IDs as a safe fallback so the
// checkout stays available while deployment variables are being synchronized.
const SINGLE_PRICE_ID = process.env.STRIPE_SINGLE_PRICE_ID || "price_1U7KOJPyO6gYxvx2wLcVO9uo";
const UNLIMITED_PRICE_ID = process.env.STRIPE_UNLIMITED_PRICE_ID || "price_1U7hzpPyO6gYxvx2ZqHeLMp2";

// ---------------------------------------------------------------------------
// In-process deduplication for unlimited checkout sessions
//
// Prevents rapid double-submits or concurrent requests from creating two
// separate Stripe sessions for the same user within this process.
//
// Each entry stores the checkout URL and an expiry matching Stripe's session
// lifetime (~30 minutes). The cache is cleared when the completed webhook
// arrives, ensuring a fresh session can always be created for a new purchase.
//
// NOTE: Multi-instance deployments that need cross-process deduplication
// should replace this with a shared store (e.g. Redis) or Stripe's customer +
// subscription lookup. For single-instance deployments this covers every
// realistic concurrent-request scenario.
// ---------------------------------------------------------------------------
const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
interface PendingSession { url: string; expiresAt: number }
const pendingUnlimitedSessions = new Map<string, PendingSession>();

/** Remove a user's pending session cache entry (call when checkout completes). */
export function clearPendingUnlimitedSession(userId: string): void {
  pendingUnlimitedSessions.delete(userId);
}

/** For testing: wipe all pending session cache entries between test cases. */
export function clearAllPendingUnlimitedSessions(): void {
  pendingUnlimitedSessions.clear();
}

// Per-user promise queue so that concurrent unlimited checkout requests within
// the same process are serialized — the second request always sees the result
// of the first (either the already_unlimited flag or the cached session URL).
const checkoutQueues = new Map<string, Promise<void>>();

function withCheckoutLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = checkoutQueues.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const slot = new Promise<void>((resolve) => { release = resolve; });
  // Store the chained promise so we can compare it for cleanup
  const queued = prev.then(() => slot);
  checkoutQueues.set(userId, queued);
  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
      if (checkoutQueues.get(userId) === queued) {
        checkoutQueues.delete(userId);
      }
    }
  });
}

function stripeForm(values: Record<string, string>) {
  return new URLSearchParams(values);
}

async function stripeRequest(path: string, body: URLSearchParams) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json() as any;
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Stripe request failed");
    (error as any).statusCode = response.status;
    throw error;
  }
  return payload;
}

router.post("/stripe/checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const kind = req.body?.kind;
    const price = kind === "single" ? SINGLE_PRICE_ID : kind === "unlimited" ? UNLIMITED_PRICE_ID : undefined;
    if (!price) {
      res.status(400).json({ error: "invalid_package" });
      return;
    }

    if (kind === "unlimited") {
      // Serialize unlimited checkout requests per user. The lock guarantees that
      // two concurrent requests cannot both pass the isUnlimited check with a
      // stale read — the second request runs only after the first has written its
      // cached session URL (or returned already_unlimited).
      const url = await withCheckoutLock(req.userId!, async () => {
        // 1. Hard block: user already has the plan.
        const [profile] = await db
          .select({ isUnlimited: profilesTable.isUnlimited })
          .from(profilesTable)
          .where(eq(profilesTable.userId, req.userId!));
        if (profile?.isUnlimited) return null; // signal already_unlimited

        // 2. Return the cached session if it is still valid.
        const pending = pendingUnlimitedSessions.get(req.userId!);
        if (pending && pending.expiresAt > Date.now()) return pending.url;

        // 3. Create a fresh Stripe Checkout Session.
        const origin = `${req.protocol}://${req.get("host")}`;
        const session = await stripeRequest("checkout/sessions", stripeForm({
          mode: "subscription",
          "line_items[0][price]": price,
          "line_items[0][quantity]": "1",
          "success_url": `${origin}/pricing?checkout=success`,
          "cancel_url": `${origin}/pricing?checkout=cancelled`,
          "allow_promotion_codes": "true",
          "metadata[userId]": req.userId!,
          "metadata[kind]": kind,
          ...(req.userEmail ? { customer_email: req.userEmail } : {}),
        }));

        // 4. Cache the URL so duplicate requests within the session window
        //    hit the same session and cannot trigger a second charge.
        pendingUnlimitedSessions.set(req.userId!, {
          url: session.url,
          expiresAt: Date.now() + CHECKOUT_SESSION_TTL_MS,
        });
        return session.url as string;
      });

      if (url === null) {
        res.status(400).json({ error: "already_unlimited" });
        return;
      }
      res.json({ url });
      return;
    }

    // Single / non-unlimited purchase — no deduplication needed
    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await stripeRequest("checkout/sessions", stripeForm({
      mode: "payment",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "success_url": `${origin}/pricing?checkout=success`,
      "cancel_url": `${origin}/pricing?checkout=cancelled`,
      "allow_promotion_codes": "true",
      "metadata[userId]": req.userId!,
      "metadata[kind]": kind,
      ...(req.userEmail ? { customer_email: req.userEmail } : {}),
    }));
    res.json({ url: session.url });
  } catch (err: any) {
    req.log.error({ err }, "Stripe checkout error");
    res.status(err?.statusCode === 400 ? 400 : 503).json({ error: "checkout_unavailable" });
  }
});

function validStripeSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const [key, value] = part.split("=", 2);
    return [key, value];
  }));
  if (!parts.t || !parts.v1) return false;
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody.toString()}`).digest("hex");
  const actual = Buffer.from(parts.v1, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

router.post("/stripe/webhook", async (req, res) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!secret || !validStripeSignature(rawBody, req.get("stripe-signature"), secret)) {
      res.status(400).json({ error: "invalid_signature" });
      return;
    }
    const event = JSON.parse(rawBody.toString("utf8"));
    if (event.type !== "checkout.session.completed") {
      res.json({ received: true });
      return;
    }
    const session = event.data?.object || {};
    const userId = String(session.metadata?.userId || "");
    const kind = session.metadata?.kind;
    if (!userId || !["single", "unlimited"].includes(kind)) {
      res.status(400).json({ error: "invalid_metadata" });
      return;
    }
    // Populate the verified email from the Stripe session so that a newly
    // created profile (missing-profile upsert path) passes isEmailUnverified
    // and can immediately use protected endpoints like /perfect.
    const customerEmail = String(
      session.customer_details?.email || session.customer_email || "",
    );
    const now = new Date();
    // Use a single DB transaction so that if the profile upsert fails after
    // the event-ID is inserted, the whole thing rolls back. Stripe will
    // re-deliver the event, and the next attempt will try again cleanly.
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(stripeEventsTable)
        .values({ id: String(event.id), userId })
        .onConflictDoNothing()
        .returning({ id: stripeEventsTable.id });
      if (inserted.length) {
        if (kind === "unlimited") {
          // Upsert: create profile if missing (e.g. user deleted account row),
          // otherwise upgrade existing profile to Power plan.
          // emailVerifiedAt is set only in VALUES (new-profile path); existing
          // profiles already have a verified timestamp and we must not overwrite it.
          await tx.insert(profilesTable)
            .values({ userId, email: customerEmail, isPremium: true, isUnlimited: true, emailVerifiedAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: profilesTable.userId,
              set: { isPremium: true, isUnlimited: true, updatedAt: now },
            });
        } else {
          // Upsert: create profile with 1 credit if missing, otherwise add 1 credit.
          await tx.insert(profilesTable)
            .values({ userId, email: customerEmail, isPremium: true, credits: 1, emailVerifiedAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: profilesTable.userId,
              set: {
                isPremium: true,
                credits: sql`${profilesTable.credits} + 1`,
                updatedAt: now,
              },
            });
        }
      }
    });
    // Clear the pending unlimited session so future legitimate checkout
    // attempts start a fresh session rather than reusing the completed one.
    if (kind === "unlimited") clearPendingUnlimitedSession(userId);
    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Stripe webhook error");
    res.status(500).json({ error: "webhook_failed" });
  }
});

export default router;