/**
 * End-to-end purchase & unlock flow (Task: "Kaufen und Freischalten komplett durchtesten").
 *
 * Walks ONE user sequentially through the whole journey against the real
 * Express app (real routes, real quota math, real webhook handler):
 *
 *   1. Fresh user: /me shows limit 3, 0 documents
 *   2. Generates + saves 3 documents (Claude mocked at fetch level)
 *   3. 4th generate → 403 free_limit_reached
 *   4. POST /checkout → Stripe Checkout session (metadata.userId set)
 *   5. Stripe webhook checkout.session.completed → is_premium=true, credits=20
 *   6. /me shows limit 23; generating works again
 *   7. Saves documents up to 23 total → generate → 403 premium_limit_reached
 *
 * Only external boundaries are faked: Supabase auth, Stripe SDK signature
 * verification, the Anthropic HTTP API, e-mail sending, and the database
 * (stateful in-memory store that actually counts inserted documents).
 */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Stateful in-memory "database"
// ---------------------------------------------------------------------------

const state = {
  profile: { userId: "e2e-user", email: "e2e@example.com", isPremium: false, credits: 0 },
  docs: [] as any[],
  processedEvents: new Set<string>(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "e2e-token"
          ? { data: { user: { id: "e2e-user", email: "e2e@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
    },
  }),
}));

vi.mock("@workspace/db", () => {
  const profilesTable = { __name: "profiles", userId: {}, credits: {} };
  const documentsTable = { __name: "documents", userId: {} };
  const stripeEventsTable = { __name: "stripe_events", id: {} };

  function makeSelect(fields?: any) {
    let table: any;
    const chain: any = {
      from(t: any) { table = t; return chain; },
      where() { return chain; },
      orderBy() { return chain; },
      limit() { return chain; },
      then(onOk: any, onErr: any) {
        let rows: any[];
        if (table === profilesTable) rows = [state.profile];
        else if (table === documentsTable) {
          // count() selections pass a fields object; return the aggregate
          rows = fields ? [{ value: state.docs.length }] : state.docs;
        } else rows = [];
        return Promise.resolve(rows).then(onOk, onErr);
      },
    };
    return chain;
  }

  const dbLike = {
    select: (fields?: any) => makeSelect(fields),
    insert(table: any) {
      return {
        values(v: any) {
          return {
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
            returning() {
              if (table === documentsTable) {
                const doc = { id: `doc-${state.docs.length + 1}`, createdAt: new Date(), ...v };
                state.docs.push(doc);
                return Promise.resolve([doc]);
              }
              return Promise.resolve([v]);
            },
            then: (onOk: any, onErr: any) => Promise.resolve([v]).then(onOk, onErr),
          };
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
                if (patch.credits !== undefined) state.profile.credits += 20; // sql`credits + 20`
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    delete: () => ({ where: () => Promise.resolve([]) }),
    transaction: async (fn: any) => fn(dbLike),
  };

  return { db: dbLike, pool: {}, profilesTable, documentsTable, stripeEventsTable };
});

// Stripe SDK: fake checkout session creation + signature verification.
const createdSessions: any[] = [];
vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (params: any) => {
          createdSessions.push(params);
          return { url: "https://checkout.stripe.com/test-session" };
        },
      },
    };
    webhooks = {
      constructEvent(body: Buffer, sig: string, _secret: string) {
        if (sig !== "valid-sig") throw new Error("bad signature");
        return JSON.parse(body.toString());
      },
    };
  },
}));

// E-mail sending: no-op
vi.mock("../lib/email", () => ({
  sendEmail: async () => {},
  buildDocumentEmail: () => ({ subject: "s", html: "<p/>" }),
}));

process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
process.env.ANTHROPIC_API_KEY = "sk-ant-fake";

// Anthropic API: mocked at the fetch boundary so /generate succeeds for real.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes("api.anthropic.com")) {
    return new Response(
      JSON.stringify({ content: [{ type: "text", text: "<div>Generierter Lebenslauf</div>" }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  return realFetch(url, init);
}) as any;

import app from "../app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const auth = (r: request.Test) => r.set("Authorization", "Bearer e2e-token");

const getMe = () => auth(request(app).get("/api/me"));
const generate = () =>
  auth(request(app).post("/api/generate")).send({ type: "cv", systemPrompt: "s", userPrompt: "u" });
const saveDocument = (n: number) =>
  auth(request(app).post("/api/documents")).send({ name: `Bewerbung ${n}`, profileData: {} });
const checkout = () => auth(request(app).post("/api/checkout")).send({});
const webhook = (eventId: string) =>
  request(app)
    .post("/api/webhook/stripe")
    .set("stripe-signature", "valid-sig")
    .set("content-type", "application/json")
    .send(
      JSON.stringify({
        id: eventId,
        type: "checkout.session.completed",
        data: { object: { metadata: { userId: "e2e-user" } } },
      }),
    );

// ---------------------------------------------------------------------------
// The full journey, in order (steps share state on purpose)
// ---------------------------------------------------------------------------

describe("E2E: 3 gratis → Kauf → 30 weitere → Limit 23", () => {
  it("step 1: fresh user sees limit 3 and 0 documents", async () => {
    const res = await getMe();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      is_premium: false,
      credits: 0,
      document_limit: 3,
      documents_count: 0,
    });
  });

  it("step 2: generates and saves 3 free documents", async () => {
    for (let n = 1; n <= 3; n++) {
      const gen = await generate();
      expect(gen.status).toBe(200);
      expect(gen.body.result).toContain("Generierter Lebenslauf");
      const save = await saveDocument(n);
      expect(save.status).toBe(201);
    }
    const me = await getMe();
    expect(me.body.documents_count).toBe(3);
  });

  it("step 3: 4th generation is blocked with free_limit_reached", async () => {
    const res = await generate();
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("free_limit_reached");
  });

  it("step 4: checkout creates a Stripe session tagged with the user id", async () => {
    const res = await checkout();
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("checkout.stripe.com");
    const session = createdSessions.at(-1);
    expect(session.mode).toBe("payment");
    expect(session.metadata.userId).toBe("e2e-user");
    expect(session.line_items[0].price_data.unit_amount).toBe(999);
  });

  it("step 5: webhook fulfillment unlocks premium with +20 credits", async () => {
    const res = await webhook("evt_e2e_1");
    expect(res.status).toBe(200);
    const me = await getMe();
    expect(me.body).toMatchObject({ is_premium: true, credits: 20, document_limit: 23 });
  });

  it("step 5b: webhook redelivery does not grant credits twice", async () => {
    const res = await webhook("evt_e2e_1");
    expect(res.status).toBe(200);
    const me = await getMe();
    expect(me.body.credits).toBe(20);
  });

  it("step 6: generation works again after purchase", async () => {
    const res = await generate();
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("Generierter Lebenslauf");
  });

  it("step 7: at 23 documents, generation is blocked with premium_limit_reached", async () => {
    // Fill up to the premium limit (3 already saved)
    for (let n = state.docs.length + 1; n <= 23; n++) {
      const save = await saveDocument(n);
      expect(save.status).toBe(201);
    }
    const me = await getMe();
    expect(me.body.documents_count).toBe(23);

    const blocked = await generate();
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe("premium_limit_reached");
  });
});
