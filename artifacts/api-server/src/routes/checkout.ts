import { Router } from "express";
import Stripe from "stripe";
import { db, profilesTable, stripeEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

router.post("/checkout", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments not configured" });
      return;
    }

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

    // Two one-time packages: premium (10 applications, 9.99) and power (50 applications, 29.90)
    const plan = (req.body as { plan?: string })?.plan === "power" ? "power" : "premium";
    const PLANS = {
      premium: { amount: 999, name: "BewerbungsKI Premium", description: "10 Bewerbungen – Einmalzahlung, kein Abo" },
      power: { amount: 2990, name: "BewerbungsKI Power", description: "50 Bewerbungen – Einmalzahlung, kein Abo" },
    } as const;
    const cfg = PLANS[plan];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: cfg.name,
              description: cfg.description,
            },
            unit_amount: cfg.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
      metadata: { userId: req.userId!, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "POST /checkout error");
    res.status(500).json({ error: "Checkout failed" });
  }
});

router.post("/webhook/stripe", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).send();
      return;
    }

    const sig = req.headers["stripe-signature"] as string | undefined;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // Fail closed: never process unverified events.
      res.status(503).json({ error: "Webhook not configured" });
      return;
    }
    if (!sig) {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch {
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        // Each completed checkout grants credits per plan (stackable packages):
        // premium = 10 applications, power = 50 applications.
        // Idempotent: record the Stripe event id first; if it was already
        // processed (redelivery), the insert is a no-op and no credits are added.
        await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(stripeEventsTable)
            .values({ id: event.id, userId })
            .onConflictDoNothing()
            .returning();
          if (inserted.length === 0) return; // duplicate delivery
          const grant = session.metadata?.plan === "power" ? 50 : 10;
          await tx
            .update(profilesTable)
            .set({
              isPremium: true,
              credits: sql`${profilesTable.credits} + ${grant}`,
            })
            .where(eq(profilesTable.userId, userId));
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Webhook error" });
  }
});

export default router;
