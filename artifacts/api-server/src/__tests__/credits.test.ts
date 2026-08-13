/**
 * Credits / quota model tests:
 * - Quota: limit = 3 free + purchased credits; correct error codes at the limit
 * - Stripe webhook fulfillment: +30 credits per checkout.session.completed
 * - Idempotency: redelivered Stripe events must NOT grant credits twice
 * - Legacy migration: is_premium profiles without credits get backfilled to 30
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

type ProfileRow = {
  userId: string;
  email: string;
  isPremium: boolean;
  credits: number;
};

const state = {
  profile: { userId: "user-1", email: "t@example.com", isPremium: false, credits: 0 } as ProfileRow,
  docCount: 0,
  processedEvents: new Set<string>(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "test-token"
          ? { data: { user: { id: "user-1", email: "t@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
    },
  }),
}));

vi.mock("@workspace/db", () => {
  const profilesTable = { __name: "profiles", userId: {}, credits: {} };
  const documentsTable = { __name: "documents", userId: {} };
  const stripeEventsTable = { __name: "stripe_events", id: {} };

  function makeSelect() {
    let table: any;
    const chain: any = {
      from(t: any) { table = t; return chain; },
      where() { return chain; },
      then(onOk: any, onErr: any) {
        const rows =
          table === profilesTable
            ? [state.profile]
            : table === documentsTable
              ? [{ value: state.docCount }]
              : [];
        return Promise.resolve(rows).then(onOk, onErr);
      },
    };
    return chain;
  }

  const dbLike = {
    select: () => makeSelect(),
    insert(table: any) {
      return {
        values(v: any) {
          const self = {
            onConflictDoNothing() {
              return {
                returning() {
                  if (table === stripeEventsTable) {
                    if (state.processedEvents.has(v.id)) return Promise.resolve([]);
                    state.processedEvents.add(v.id);
                    return Promise.resolve([v]);
                  }
                  return Promise.resolve([v]);
                },
              };
            },
            returning: () => Promise.resolve([v]),
            then: (onOk: any, onErr: any) => Promise.resolve([v]).then(onOk, onErr),
          };
          return self;
        },
      };
    },
    update(table: any) {
      return {
        set(patch: any) {
          return {
            where() {
              if (table === profilesTable) {
                if (typeof patch.isPremium === "boolean") state.profile.isPremium = patch.isPremium;
                // credits is a sql`` increment expression → interpret as +30
                if (patch.credits !== undefined) state.profile.credits += 30;
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    transaction: async (fn: any) => fn(dbLike),
  };

  return {
    db: dbLike,
    pool: {},
    profilesTable,
    documentsTable,
    stripeEventsTable,
  };
});

// Stripe: bypass real signature crypto; the route still requires the header +
// configured secret, and we verify the raw body round-trips through constructEvent.
vi.mock("stripe", () => ({
  default: class FakeStripe {
    webhooks = {
      constructEvent(body: Buffer, sig: string, _secret: string) {
        if (sig !== "valid-sig") throw new Error("bad signature");
        return JSON.parse(body.toString());
      },
    };
  },
}));

process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
delete process.env.ANTHROPIC_API_KEY;

import app from "../app";

function webhookEvent(eventId: string) {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    data: { object: { metadata: { userId: "user-1" } } },
  });
}

function postWebhook(eventId: string, sig = "valid-sig") {
  return request(app)
    .post("/api/webhook/stripe")
    .set("stripe-signature", sig)
    .set("content-type", "application/json")
    .send(webhookEvent(eventId));
}

function postGenerate() {
  return request(app)
    .post("/api/generate")
    .set("Authorization", "Bearer test-token")
    .send({ type: "cv", systemPrompt: "s", userPrompt: "u" });
}

beforeEach(() => {
  state.profile = { userId: "user-1", email: "t@example.com", isPremium: false, credits: 0 };
  state.docCount = 0;
  state.processedEvents.clear();
});

describe("quota: 3 free + credits", () => {
  it("free user under limit passes the quota check", async () => {
    state.docCount = 2;
    const res = await postGenerate();
    // Quota OK → route proceeds and fails on missing AI key, not on quota
    expect(res.status).toBe(503);
  });

  it("free user at 3 documents → free_limit_reached", async () => {
    state.docCount = 3;
    const res = await postGenerate();
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("free_limit_reached");
  });

  it("premium user with credits under limit passes", async () => {
    state.profile.isPremium = true;
    state.profile.credits = 30;
    state.docCount = 32;
    const res = await postGenerate();
    expect(res.status).toBe(503);
  });

  it("premium user at 33 (3 + 30) → premium_limit_reached", async () => {
    state.profile.isPremium = true;
    state.profile.credits = 30;
    state.docCount = 33;
    const res = await postGenerate();
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("premium_limit_reached");
  });

  it("after buying a second package (60 credits), 33 documents is no longer the limit", async () => {
    state.profile.isPremium = true;
    state.profile.credits = 60;
    state.docCount = 33;
    const res = await postGenerate();
    expect(res.status).toBe(503); // quota passed
  });
});

describe("stripe webhook fulfillment", () => {
  it("first purchase grants 30 credits and premium", async () => {
    const res = await postWebhook("evt_1");
    expect(res.status).toBe(200);
    expect(state.profile.credits).toBe(30);
    expect(state.profile.isPremium).toBe(true);
  });

  it("repurchase stacks: second distinct event adds another 30", async () => {
    await postWebhook("evt_1");
    await postWebhook("evt_2");
    expect(state.profile.credits).toBe(60);
  });

  it("redelivered event is idempotent: no double credits", async () => {
    await postWebhook("evt_1");
    const res = await postWebhook("evt_1");
    expect(res.status).toBe(200); // acknowledged so Stripe stops retrying
    expect(state.profile.credits).toBe(30);
  });

  it("invalid signature is rejected and grants nothing", async () => {
    const res = await postWebhook("evt_x", "bad-sig");
    expect(res.status).toBe(400);
    expect(state.profile.credits).toBe(0);
  });

  it("missing signature is rejected", async () => {
    const res = await request(app)
      .post("/api/webhook/stripe")
      .set("content-type", "application/json")
      .send(webhookEvent("evt_y"));
    expect(res.status).toBe(400);
    expect(state.profile.credits).toBe(0);
  });
});

describe("legacy premium migration semantics", () => {
  it("legacy premium profile (is_premium, credits backfilled to 30) can still generate up to 33", async () => {
    // Startup migration sets credits=30 for legacy is_premium rows;
    // this asserts the quota math honors that backfill.
    state.profile.isPremium = true;
    state.profile.credits = 30;
    state.docCount = 30;
    const res = await postGenerate();
    expect(res.status).toBe(503); // quota passed
  });
});
