/**
 * Stripe Webhook + Checkout – Kauf-Paket-Gutschrift
 *
 * Abgedeckt:
 *  1. Power-Kauf (unlimited) setzt is_unlimited=true, is_premium=true
 *  2. Single-Kauf (10er) erhöht credits um 1
 *  3. Duplicate-Webhook-Event wird ignoriert (Idempotenz)
 *  4. Ungültige Signatur → 400
 *  5. Fehlende userId/kind in Metadata → 400
 *  6. Fehlende Profil-Zeile → Upsert legt neues Profil an
 *  7. Premium-Nutzer kauft Power (Upgrade) → isUnlimited wird gesetzt
 *  8. Checkout blockiert Doppelkauf (already_unlimited) → 400
 *  9. Checkout: ungültiger kind → 400
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Shared in-memory state for the DB mock
// ---------------------------------------------------------------------------

type ProfileRow = {
  userId: string;
  email: string;
  isPremium: boolean;
  isUnlimited: boolean;
  credits: number;
  emailVerifiedAt: Date | null;
  perfectCount: number;
  dailyPerfectCount: number;
  dailyPerfectDate: string | null;
  dailyDocCount: number;
  dailyDocDate: string | null;
  freeTrialsUsed: number;
  updatedAt: Date;
};

const state = {
  profile: null as ProfileRow | null,
  stripeEventIds: new Set<string>(),
  profileUpsertCount: 0,
  failNextProfileUpsert: false, // set true to simulate a transient DB error on upsert
};

function resetState(profileOverride: Partial<ProfileRow> | null = {}) {
  state.profile =
    profileOverride === null
      ? null
      : {
          userId: "user-1",
          email: "test@example.com",
          isPremium: false,
          isUnlimited: false,
          credits: 0,
          emailVerifiedAt: new Date(),
          perfectCount: 0,
          dailyPerfectCount: 0,
          dailyPerfectDate: null,
          dailyDocCount: 0,
          dailyDocDate: null,
          freeTrialsUsed: 0,
          updatedAt: new Date(),
          ...profileOverride,
        };
  state.stripeEventIds = new Set();
  state.profileUpsertCount = 0;
  state.failNextProfileUpsert = false;
}

// ---------------------------------------------------------------------------
// Helper: resolve a drizzle sql`` expression against a row
// ---------------------------------------------------------------------------
function resolveDrizzleSql(expr: any, row: Record<string, any>): any {
  if (!expr || typeof expr !== "object" || !Array.isArray(expr.queryChunks)) return expr;
  const chunks: any[] = expr.queryChunks;
  const strParts = chunks
    .filter((c: any) => Array.isArray(c?.value))
    .map((c: any) => String(c.value[0] ?? ""))
    .join("");
  // Column references: has .name, no .value array
  const colRefs = chunks.filter(
    (c: any) => c && typeof c.name === "string" && !Array.isArray(c.value),
  );
  const mainColName = colRefs[0]?.name ?? "";
  const current = Number(row[mainColName] ?? 0);

  if (strParts.includes("GREATEST") && strParts.includes("- 1")) {
    return Math.max(current - 1, 0);
  }
  if (strParts.includes("CASE WHEN") && strParts.includes("ELSE 1 END")) {
    const today = new Date().toISOString().slice(0, 10);
    const dateColName = colRefs[0]?.name ?? "";
    const countColName = colRefs[1]?.name ?? "";
    const currentDate = row[dateColName];
    const currentCount = Number(row[countColName] ?? 0);
    return currentDate === today ? currentCount + 1 : 1;
  }
  if (strParts.includes("+ 1")) return current + 1;
  return current;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "test-token"
          ? { data: { user: { id: "user-1", email: "test@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
    },
  }),
}));

vi.mock("@workspace/db", () => {
  const profilesTable = {
    __name: "profiles",
    userId: { name: "userId" },
    isUnlimited: { name: "isUnlimited" },
    isPremium: { name: "isPremium" },
    credits: { name: "credits" },
    perfectCount: { name: "perfectCount" },
    dailyPerfectCount: { name: "dailyPerfectCount" },
    dailyPerfectDate: { name: "dailyPerfectDate" },
    dailyDocCount: { name: "dailyDocCount" },
    dailyDocDate: { name: "dailyDocDate" },
    updatedAt: { name: "updatedAt" },
    email: { name: "email" },
    emailVerifiedAt: { name: "emailVerifiedAt" },
    savedProfile: { name: "savedProfile" },
    freeTrialsUsed: { name: "freeTrialsUsed" },
  };
  const stripeEventsTable = {
    __name: "stripe_events",
    id: { name: "id" },
    userId: { name: "userId" },
  };
  const documentsTable = { __name: "documents", userId: { name: "userId" } };
  const perfectedGenerationsTable = { __name: "perfected_generations" };

  /**
   * Build a db-like object that operates on snapshot copies of the shared
   * state. The `commit` callback is called after the transaction succeeds; if
   * the callback throws, the snapshots are simply discarded (rollback).
   */
  function buildDbOps(
    snapProfile: () => ProfileRow | null,
    snapEventIds: () => Set<string>,
    setProfile: (p: ProfileRow | null) => void,
    addEventId: (id: string) => void,
    hasEventId: (id: string) => boolean,
    incUpsert: () => void,
  ) {
    return {
      select: (..._args: any[]) => ({
        from: (table: any) => ({
          where: () => {
            if (table === profilesTable) {
              const p = snapProfile();
              return {
                then: (ok: any, err: any) => Promise.resolve(p ? [p] : []).then(ok, err),
                limit: (n: number) => Promise.resolve(p ? [p].slice(0, n) : []),
              };
            }
            return {
              then: (ok: any, err: any) => Promise.resolve([]).then(ok, err),
              limit: () => Promise.resolve([]),
            };
          },
        }),
      }),

      update: (table: any) => ({
        set: (patch: any) => ({
          where: () => {
            const p = snapProfile();
            if (table === profilesTable && p) {
              const resolved: Record<string, any> = {};
              for (const [k, v] of Object.entries(patch)) {
                resolved[k] = resolveDrizzleSql(v, p as Record<string, any>);
              }
              setProfile({ ...p, ...resolved });
            }
            const updated = snapProfile();
            return {
              returning: () => Promise.resolve(updated ? [updated] : []),
              then: (ok: any, err: any) =>
                Promise.resolve(updated ? [updated] : []).then(ok, err),
            };
          },
        }),
      }),

      insert: (table: any) => ({
        values: (values: any) => ({
          returning: (_projection?: any) => {
            if (table === stripeEventsTable) {
              if (hasEventId(String(values.id))) return Promise.resolve([]);
              addEventId(String(values.id));
              return Promise.resolve([{ id: values.id }]);
            }
            return Promise.resolve([values]);
          },
          onConflictDoNothing: () => ({
            returning: (_projection?: any) => {
              if (table === stripeEventsTable) {
                if (hasEventId(String(values.id))) return Promise.resolve([]);
                addEventId(String(values.id));
                return Promise.resolve([{ id: values.id }]);
              }
              return Promise.resolve([]);
            },
          }),
          onConflictDoUpdate: ({ set }: { set: Record<string, any> }) => ({
            returning: () => Promise.resolve([snapProfile() ?? values]),
            then: (ok: any, err: any) => {
              if (table === profilesTable) {
                if (state.failNextProfileUpsert) {
                  state.failNextProfileUpsert = false;
                  return Promise.reject(new Error("simulated transient DB error")).then(ok, err);
                }
                const p = snapProfile();
                if (p && p.userId === String(values.userId)) {
                  // Conflict → apply SET
                  const resolved: Record<string, any> = {};
                  for (const [k, v] of Object.entries(set)) {
                    resolved[k] = resolveDrizzleSql(v, p as Record<string, any>);
                  }
                  setProfile({ ...p, ...resolved });
                } else {
                  // No row → insert new profile using VALUES (including emailVerifiedAt)
                  setProfile({
                    userId: values.userId,
                    email: values.email ?? "",
                    isPremium: values.isPremium ?? false,
                    isUnlimited: values.isUnlimited ?? false,
                    credits: values.credits ?? 0,
                    emailVerifiedAt: values.emailVerifiedAt ?? null,
                    perfectCount: 0,
                    dailyPerfectCount: 0,
                    dailyPerfectDate: null,
                    dailyDocCount: 0,
                    dailyDocDate: null,
                    freeTrialsUsed: 0,
                    updatedAt: new Date(),
                  });
                }
                incUpsert();
              }
              return Promise.resolve([snapProfile()]).then(ok, err);
            },
          }),
        }),
      }),

      delete: () => ({ where: () => Promise.resolve([]) }),
    };
  }

  // Main db object — reads/writes go directly to `state`
  const dbLike: any = {
    ...buildDbOps(
      () => state.profile,
      () => state.stripeEventIds,
      (p) => { state.profile = p; },
      (id) => state.stripeEventIds.add(id),
      (id) => state.stripeEventIds.has(id),
      () => { state.profileUpsertCount++; },
    ),

    // transaction: run `fn` against isolated snapshots; commit on success,
    // discard (rollback) on error by never publishing the snapshots.
    transaction: async (fn: (tx: any) => Promise<void>) => {
      // Take snapshots
      let txProfile = state.profile ? { ...state.profile } : null;
      const txEventIds = new Set(state.stripeEventIds);
      let txProfileModified = false;

      const txDb = buildDbOps(
        () => txProfile,
        () => txEventIds,
        (p) => { txProfile = p; },
        (id) => txEventIds.add(id),
        (id) => txEventIds.has(id),
        () => { txProfileModified = true; }, // track actual profile upserts
      );

      // Run the transaction body; on success, publish snapshots to real state
      await fn(txDb);

      // Commit: publish snapshots (no writes if fn threw, so this path = success)
      state.profile = txProfile;
      for (const id of txEventIds) state.stripeEventIds.add(id);
      if (txProfileModified) state.profileUpsertCount++;
    },
  };

  return {
    db: dbLike,
    pool: {},
    profilesTable,
    stripeEventsTable,
    documentsTable,
    perfectedGenerationsTable,
  };
});

// Block real Stripe API calls; track checkout session creation for deduplication tests
let stripeCheckoutCallCount = 0;
let stripeCheckoutCallDelay = 0; // ms — set per-test to simulate slow Stripe API

const realFetch = global.fetch;
global.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  if (url.includes("api.stripe.com/v1/checkout/sessions")) {
    if (stripeCheckoutCallDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, stripeCheckoutCallDelay));
    }
    stripeCheckoutCallCount++;
    return new Response(
      JSON.stringify({ url: `https://checkout.stripe.com/session-${stripeCheckoutCallCount}` }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("api.stripe.com")) {
    return new Response(JSON.stringify({ url: "https://checkout.stripe.com/test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

import app from "../app";
import { clearAllPendingUnlimitedSessions } from "../routes/stripe";

// ---------------------------------------------------------------------------
// Webhook helper: build a valid Stripe-signed payload
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = "whsec_test_secret_for_e2e";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_SECRET_KEY = "sk_test_fake";

function makeStripeEvent(
  overrides: { dataObject?: Record<string, any>; type?: string; id?: string } = {},
) {
  return {
    id: overrides.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? "checkout.session.completed",
    data: {
      object: {
        metadata: { userId: "user-1", kind: "unlimited" },
        ...overrides.dataObject,
      },
    },
  };
}

function signWebhook(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

async function sendWebhook(event: object) {
  const body = JSON.stringify(event);
  const sig = signWebhook(body, WEBHOOK_SECRET);
  return request(app)
    .post("/api/stripe/webhook")
    .set("stripe-signature", sig)
    .set("Content-Type", "application/json")
    .send(body);
}

// ---------------------------------------------------------------------------
// Tests – Webhook: Power-Kauf
// ---------------------------------------------------------------------------

describe("Stripe webhook – Power-Kauf (unlimited)", () => {
  beforeEach(() => resetState());

  it("setzt is_unlimited=true und is_premium=true nach Power-Kauf", async () => {
    const event = makeStripeEvent();
    const res = await sendWebhook(event);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(state.profile?.isUnlimited).toBe(true);
    expect(state.profile?.isPremium).toBe(true);
  });

  it("doppeltes Webhook-Event wird ignoriert – Profil nur einmal geändert", async () => {
    const event = makeStripeEvent({ id: "evt_dup_power" });
    await sendWebhook(event);
    const afterFirst = state.profileUpsertCount;

    await sendWebhook(event); // identical re-delivery
    expect(state.profileUpsertCount).toBe(afterFirst);
    expect(state.profile?.isUnlimited).toBe(true);
  });

  it("Upgrade Premium→Power: isPremium-Nutzer erhält zusätzlich isUnlimited", async () => {
    resetState({ isPremium: true, isUnlimited: false });
    const event = makeStripeEvent();
    await sendWebhook(event);
    expect(state.profile?.isPremium).toBe(true);
    expect(state.profile?.isUnlimited).toBe(true);
  });

  it("fehlendes Profil → Webhook erstellt neues Profil via Upsert", async () => {
    resetState(null); // no profile in DB
    const event = makeStripeEvent();
    const res = await sendWebhook(event);
    expect(res.status).toBe(200);
    expect(state.profile).not.toBeNull();
    expect(state.profile?.isUnlimited).toBe(true);
    expect(state.profile?.isPremium).toBe(true);
  });

  it("fehlendes Profil → Käufer kann sofort geschützte Aktionen nutzen (emailVerifiedAt gesetzt)", async () => {
    // Regression: the upsert previously created a profile with emailVerifiedAt=null,
    // which made isEmailUnverified() return true and blocked /perfect with 403.
    resetState(null); // no profile exists before purchase
    const event = makeStripeEvent({
      dataObject: {
        metadata: { userId: "user-1", kind: "unlimited" },
        customer_details: { email: "buyer@example.com" },
      },
    });
    const res = await sendWebhook(event);
    expect(res.status).toBe(200);
    expect(state.profile?.isUnlimited).toBe(true);
    // emailVerifiedAt must be set — this is what isEmailUnverified() checks.
    // Without it, the purchaser would get 403 email_unverified on every /perfect call.
    expect(state.profile?.emailVerifiedAt).not.toBeNull();
    // Email should be populated from Stripe customer data (not an empty string)
    expect(state.profile?.email).toBe("buyer@example.com");
  });

  it("transienter Profil-Fehler rollt auch die Event-ID zurück → Stripe-Retry gutschreibt korrekt", async () => {
    // First delivery: profile upsert fails → transaction rolls back everything
    state.failNextProfileUpsert = true;
    const event = makeStripeEvent({ id: "evt_retry_atomicity" });
    const res1 = await sendWebhook(event);
    // Webhook returns 500 because the transaction threw
    expect(res1.status).toBe(500);
    // Profile unchanged, event NOT committed (rolled back)
    expect(state.profile?.isUnlimited).toBe(false);
    expect(state.stripeEventIds.has("evt_retry_atomicity")).toBe(false);

    // Second delivery (Stripe retry): should succeed now
    const res2 = await sendWebhook(event);
    expect(res2.status).toBe(200);
    expect(state.profile?.isUnlimited).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests – Webhook: Single-Kauf
// ---------------------------------------------------------------------------

describe("Stripe webhook – Single-Kauf (10er / credits)", () => {
  beforeEach(() => resetState());

  it("erhöht credits um 1 nach Single-Kauf", async () => {
    const event = makeStripeEvent({
      dataObject: { metadata: { userId: "user-1", kind: "single" } },
    });
    const res = await sendWebhook(event);
    expect(res.status).toBe(200);
    expect(state.profile?.credits).toBe(1);
    expect(state.profile?.isPremium).toBe(true);
    expect(state.profile?.isUnlimited).toBe(false);
  });

  it("Duplikat-Event beim Single-Kauf → credits nur einmal erhöht", async () => {
    const event = makeStripeEvent({
      id: "evt_dup_single",
      dataObject: { metadata: { userId: "user-1", kind: "single" } },
    });
    await sendWebhook(event);
    const afterFirst = state.profile?.credits ?? 0;

    await sendWebhook(event);
    expect(state.profile?.credits).toBe(afterFirst);
  });

  it("fehlendes Profil → Single-Kauf legt Profil mit credits=1 an", async () => {
    resetState(null);
    const event = makeStripeEvent({
      dataObject: { metadata: { userId: "user-1", kind: "single" } },
    });
    await sendWebhook(event);
    expect(state.profile).not.toBeNull();
    expect(state.profile?.credits).toBe(1);
    expect(state.profile?.isPremium).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests – Webhook: Validierung
// ---------------------------------------------------------------------------

describe("Stripe webhook – Validierung", () => {
  beforeEach(() => resetState());

  it("ungültige Signatur → 400 invalid_signature", async () => {
    const body = JSON.stringify(makeStripeEvent());
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "t=1234,v1=badhash")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_signature");
  });

  it("fehlende userId in Metadata → 400 invalid_metadata", async () => {
    const event = makeStripeEvent({
      dataObject: { metadata: { kind: "unlimited" } },
    });
    const res = await sendWebhook(event);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_metadata");
  });

  it("unbekannter kind in Metadata → 400 invalid_metadata", async () => {
    const event = makeStripeEvent({
      dataObject: { metadata: { userId: "user-1", kind: "enterprise" } },
    });
    const res = await sendWebhook(event);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_metadata");
  });

  it("anderer Event-Typ wird ignoriert (received: true, kein Profil-Update)", async () => {
    const event = makeStripeEvent({ type: "payment_intent.created" });
    const res = await sendWebhook(event);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(state.profile?.isUnlimited).toBe(false); // unchanged
  });
});

// ---------------------------------------------------------------------------
// Tests – Checkout: Doppelkauf-Blockade & Validierung
// ---------------------------------------------------------------------------

const auth = { Authorization: "Bearer test-token" };

describe("Stripe checkout – Doppelkauf-Blockade & Validierung", () => {
  beforeEach(() => {
    resetState();
    stripeCheckoutCallCount = 0;
    stripeCheckoutCallDelay = 0;
    clearAllPendingUnlimitedSessions();
  });

  it("bereits unlimited → 400 already_unlimited", async () => {
    resetState({ isUnlimited: true });
    const res = await request(app)
      .post("/api/stripe/checkout")
      .set(auth)
      .send({ kind: "unlimited" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("already_unlimited");
  });

  it("nicht-unlimited Nutzer kann Power kaufen (Checkout-URL erhalten)", async () => {
    resetState({ isUnlimited: false });
    const res = await request(app)
      .post("/api/stripe/checkout")
      .set(auth)
      .send({ kind: "unlimited" });
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  it("Single-Kauf ist auch für unlimited Nutzer erlaubt", async () => {
    resetState({ isUnlimited: true });
    const res = await request(app)
      .post("/api/stripe/checkout")
      .set(auth)
      .send({ kind: "single" });
    expect(res.status).toBe(200);
    expect(res.body.url).toBeDefined();
  });

  it("ungültiger kind → 400 invalid_package", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .set(auth)
      .send({ kind: "gold" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_package");
  });

  it("gleichzeitige Power-Kauf-Anfragen → nur eine Stripe-Session (kein doppelter Abzug)", async () => {
    // Regression: before the per-user checkout lock was added, two concurrent
    // requests could both pass the isUnlimited=false check and create two
    // separate Stripe Checkout Sessions, allowing two distinct subscriptions
    // to be charged for the same user.
    resetState({ isUnlimited: false });
    // Make the Stripe API mock take 50 ms so both requests are truly in-flight
    // at the same time within Node's event loop when Promise.all fires them.
    stripeCheckoutCallDelay = 50;

    const [res1, res2] = await Promise.all([
      request(app).post("/api/stripe/checkout").set(auth).send({ kind: "unlimited" }),
      request(app).post("/api/stripe/checkout").set(auth).send({ kind: "unlimited" }),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Only ONE Stripe Checkout Session must have been created — the second
    // request returned the cached session URL, not a brand-new session.
    expect(stripeCheckoutCallCount).toBe(1);

    // Both callers receive the identical checkout URL (same session, one charge).
    expect(res1.body.url).toBe(res2.body.url);
  });
});
