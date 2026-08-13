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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "BewerbungsKI Premium",
              description: "30 Bewerbungen – Einmalzahlung, kein Abo",
            },
            unit_amount: 999,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
      metadata: { userId: req.userId! },
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
        // Each completed checkout grants 30 more applications (stackable packages).
        // Idempotent: record the Stripe event id first; if it was already
        // processed (redelivery), the insert is a no-op and no credits are added.
        await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(stripeEventsTable)
            .values({ id: event.id, userId })
            .onConflictDoNothing()
            .returning();
          if (inserted.length === 0) return; // duplicate delivery
          await tx
            .update(profilesTable)
            .set({
              isPremium: true,
              credits: sql`${profilesTable.credits} + 30`,
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
