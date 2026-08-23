import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db, profilesTable, stripeEventsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
const SINGLE_PRICE_ID = process.env.STRIPE_SINGLE_PRICE_ID;
const UNLIMITED_PRICE_ID = process.env.STRIPE_UNLIMITED_PRICE_ID;

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
    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await stripeRequest("checkout/sessions", stripeForm({
      mode: kind === "unlimited" ? "subscription" : "payment",
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
    const inserted = await db.insert(stripeEventsTable)
      .values({ id: String(event.id), userId })
      .onConflictDoNothing()
      .returning({ id: stripeEventsTable.id });
    if (inserted.length) {
      if (kind === "unlimited") {
        await db.update(profilesTable)
          .set({ isPremium: true, isUnlimited: true, updatedAt: new Date() })
          .where(eq(profilesTable.userId, userId));
      } else {
        await db.update(profilesTable)
          .set({ isPremium: true, credits: sql`${profilesTable.credits} + 1`, updatedAt: new Date() })
          .where(eq(profilesTable.userId, userId));
      }
    }
    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Stripe webhook error");
    res.status(500).json({ error: "webhook_failed" });
  }
});

export default router;