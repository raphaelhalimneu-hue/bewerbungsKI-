import { Router } from "express";
import Stripe from "stripe";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
              description: "Unbegrenzte Bewerbungen – Lifetime",
            },
            unit_amount: 990,
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

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;
    try {
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = req.body as Stripe.Event;
      }
    } catch {
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await db
          .update(profilesTable)
          .set({ isPremium: true })
          .where(eq(profilesTable.userId, userId));
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Webhook error" });
  }
});

export default router;
