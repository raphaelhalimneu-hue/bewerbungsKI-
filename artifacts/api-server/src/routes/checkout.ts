import { Router } from "express";
import Stripe from "stripe";
import { db, profilesTable, documentsTable, stripeEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

const PLANS = {
  single: { amount: 299, credits: 1, name: "BewerbungsKI Einzelbewerbung", description: "1 Bewerbung – Einmalzahlung, kein Abo" },
  starter: { amount: 999, credits: 5, name: "BewerbungsKI 5er-Paket", description: "5 Bewerbungen – Einmalzahlung, kein Abo" },
  premium: { amount: 1499, credits: 10, name: "BewerbungsKI 10er-Paket", description: "10 Bewerbungen – Einmalzahlung, kein Abo" },
  power: { amount: 2990, name: "BewerbungsKI Power", description: "Unbegrenzt Bewerbungen – Einmalzahlung, kein Abo" },
} as const;

type CreditPlan = keyof Pick<typeof PLANS, "single" | "starter" | "premium">;

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

    // One-time packages: single (1 application, 2.99), starter (5, 9.99),
    // premium (10, 14.99), and power (unlimited, 29.90).
    const requestedPlan = (req.body as { plan?: string })?.plan;
    const plan = requestedPlan === "single" || requestedPlan === "starter" || requestedPlan === "power"
      ? requestedPlan
      : "premium";
    const cfg = PLANS[plan];

    // A Power (unlimited) account gains nothing from buying again — block it.
    if (plan === "power") {
      const [prof] = await db.select().from(profilesTable).where(eq(profilesTable.userId, req.userId!));
      if (prof?.isUnlimited) {
        res.status(400).json({ error: "already_unlimited" });
        return;
      }
    }

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
        // premium = +10 applications (stackable); power = unlimited applications.
        // Idempotent: record the Stripe event id first; if it was already
        // processed (redelivery), the insert is a no-op and no credits are added.
        await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(stripeEventsTable)
            .values({ id: event.id, userId })
            .onConflictDoNothing()
            .returning();
          if (inserted.length === 0) return; // duplicate delivery
          // Upsert so a missing profile row can never swallow a paid purchase.
          const email = session.customer_details?.email || "";
          if (session.metadata?.plan === "power") {
            // Power: unlimited applications, perfect capped separately.
            await tx
              .insert(profilesTable)
              .values({ userId, email, isPremium: true, isUnlimited: true })
              .onConflictDoUpdate({
                target: profilesTable.userId,
                set: { isPremium: true, isUnlimited: true },
              });
          } else {
            const creditPlan: CreditPlan =
              session.metadata?.plan === "single" ||
              session.metadata?.plan === "starter" ||
              session.metadata?.plan === "premium"
                ? session.metadata.plan
                : "premium";
            const credits = PLANS[creditPlan].credits;
            await tx
              .insert(profilesTable)
              .values({ userId, email, isPremium: true, credits })
              .onConflictDoUpdate({
                target: profilesTable.userId,
                set: {
                  isPremium: true,
                  credits: sql`${profilesTable.credits} + ${credits}`,
                },
              });
          }
          await tx
            .update(documentsTable)
            .set({ bezahlt: true })
            .where(eq(documentsTable.userId, userId));
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Webhook error" });
  }
});

export default router;
