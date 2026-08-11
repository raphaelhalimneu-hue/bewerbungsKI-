import { Router } from "express";
import Stripe from "stripe";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

const ADMIN_EMAILS = [
  "raphaelhalimneu+app@gmail.com",
  "raphaelhalim99@gmail.com",
];

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function requireAdmin(req: AuthenticatedRequest, res: any): boolean {
  const email = (req.userEmail || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

router.get("/admin/purchases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments not configured" });
      return;
    }
    const charges = await stripe.charges.list({ limit: 50 });
    const purchases = charges.data.map((c) => ({
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      created: c.created,
      email: c.billing_details?.email || c.receipt_email || "",
      status: c.status,
      refunded: c.refunded,
      amountRefunded: c.amount_refunded,
    }));
    res.json({ purchases });
  } catch (err) {
    console.error("admin purchases error", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/admin/refund", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments not configured" });
      return;
    }
    const chargeId = typeof req.body?.chargeId === "string" ? req.body.chargeId : "";
    if (!chargeId.startsWith("ch_")) {
      res.status(400).json({ error: "invalid_charge_id" });
      return;
    }
    const refund = await stripe.refunds.create(
      { charge: chargeId },
      { idempotencyKey: `admin-refund-${chargeId}` }
    );
    console.log(`[admin-refund] admin=${req.userEmail} charge=${chargeId} refund=${refund.id} status=${refund.status}`);
    res.json({ ok: true, refundId: refund.id, status: refund.status });
  } catch (err: any) {
    console.error("admin refund error", err);
    const msg = err?.raw?.message || "refund_failed";
    res.status(400).json({ error: msg });
  }
});

export default router;
