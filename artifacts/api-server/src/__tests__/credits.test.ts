/**
 * Power-Plan (is_unlimited) – Perfektionierungslimit & Fair-Use
 *
 * Abgedeckt:
 *  1.  Unlimited-Nutzer mit perfectCount=49 → 50. Aufruf erfolgreich (200)
 *  2.  Unlimited-Nutzer mit perfectCount=50 → 429 perfect_limit_reached
 *  3.  Fehlgeschlagener KI-Aufruf verbraucht keinen Zähler (perfectCount bleibt gleich)
 *  4.  Fair-Use: 11. Perfektionierung am selben Tag → 429 daily_limit_reached
 *  5.  Single-Nutzer (credits=1) kann POST /perfect aufrufen
 *  6.  perfectCount wird nur für unlimited Nutzer inkrementiert
 *  7.  GET /me liefert perfect_remaining für unlimited Nutzer
 *  8.  Power-Nutzer kann 11. Dokument insgesamt erstellen
 *  9.  Power-Nutzer: 11. Dokument am selben Tag → 429 daily_document_limit_reached
 *  10. Rollback nach Mitternacht dekrementiert dailyPerfectCount des neuen Tages nicht
 *  11. Fehlgeschlagenes Dokument-Insert gibt den Tages-Slot wieder frei
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Shared state
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
  updatedAt: Date;
  savedProfile?: any;
  freeTrialsUsed?: number;
};

const state = {
  profile: null as ProfileRow | null,
  docCount: 0,
  claudeFailNext: false,
  claudeCallCount: 0,
  perfectCountDeltas: [] as number[], // +1 on reserve, -1 on rollback
  // Simulate midnight crossing between reservation and rollback:
  // After the reservation update is applied, the mock changes dailyPerfectDate + dailyPerfectCount
  // to a new-day value before the rollback runs, testing that the date guard works.
  simulateMidnightCrossing: false,
  // Simulate a transient error during document insert (inside the transaction):
  failNextDocInsert: false,
  // Simulate a transient error during perfected-generation insert (after Claude succeeds):
  failNextGenInsert: false,
};

const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function resetState(profileOverride: Partial<ProfileRow> = {}, docCount = 0) {
  state.profile = {
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
    updatedAt: new Date(),
    freeTrialsUsed: 0,
    ...profileOverride,
  };
  state.docCount = docCount;
  state.claudeFailNext = false;
  state.claudeCallCount = 0;
  state.perfectCountDeltas = [];
  state.simulateMidnightCrossing = false;
  state.failNextDocInsert = false;
  state.failNextGenInsert = false;
}

// ---------------------------------------------------------------------------
// Helper: resolve a drizzle sql`` expression against a profile row.
//
// In real drizzle-orm, a sql`...` template creates an SQL object whose
// queryChunks alternate between:
//   - StringChunk { value: string[] }  ← raw SQL text (value IS an array)
//   - Param { value: T }               ← embedded JS value (value is NOT an array)
//
// Our mock schema "columns" are plain objects { name: "..." }. When embedded
// in sql`...`, they become Params: { value: { name: "dailyPerfectDate" } }.
// String values like `today` become: { value: "2024-01-15" }.
//
// strParts (for pattern detection) = concatenated StringChunk values.
// colNames (column references) = Param values that are { name: string } objects.
// dateLiterals (embedded date strings) = Param values matching YYYY-MM-DD.
// ---------------------------------------------------------------------------
function resolvePatch(patch: Record<string, any>, row: ProfileRow): Partial<ProfileRow> {
  const today = new Date().toISOString().slice(0, 10);
  const result: Record<string, any> = {};

  for (const [k, v] of Object.entries(patch)) {
    // Plain values (string, number, Date, null)
    if (typeof v !== "object" || v === null || v instanceof Date) {
      result[k] = v;
      continue;
    }
    if (!Array.isArray(v.queryChunks)) {
      result[k] = v;
      continue;
    }

    const chunks: any[] = v.queryChunks;

    // strParts: raw SQL string fragments only (StringChunk.value is a string[])
    const strParts = chunks
      .filter((c: any) => Array.isArray(c?.value))
      .map((c: any) => String(c.value[0] ?? ""))
      .join("");

    // Column names: chunks that are plain mock-schema column objects { name: string }.
    // Drizzle places embedded JS values directly in queryChunks (not wrapped in Param).
    const colNames: string[] = chunks
      .filter(
        (c: any) =>
          c !== null &&
          typeof c === "object" &&
          !Array.isArray(c?.value) &&
          typeof c.name === "string",
      )
      .map((c: any) => c.name as string);

    // Date literals: chunks that are bare YYYY-MM-DD strings (e.g. `today` variable).
    const dateLiterals: string[] = chunks
      .filter((c: any) => typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c))
      .map((c: any) => c as string);

    const current = Number((row as any)[k] ?? 0);

    if (strParts.includes("CASE WHEN") && strParts.includes("GREATEST")) {
      // CASE WHEN dateCol = reservationDate THEN GREATEST(countCol - 1, 0) ELSE countCol END
      // Only decrements if the profile's date still matches the reservation date
      // (guards against decrementing the next day's counter after midnight crossing).
      const dateColName = colNames[0] ?? "";
      const reserveDate = dateLiterals[0] ?? "";
      const currentDate = (row as any)[dateColName];
      result[k] = reserveDate && currentDate === reserveDate ? Math.max(current - 1, 0) : current;
    } else if (strParts.includes("GREATEST") && strParts.includes("- 1")) {
      // GREATEST(col - 1, 0) → unconditional decrement (e.g. perfectCount rollback)
      result[k] = Math.max(current - 1, 0);
    } else if (strParts.includes("CASE WHEN") && strParts.includes("ELSE 1 END")) {
      // CASE WHEN dateCol = today THEN countCol + 1 ELSE 1 END  (reservation)
      const dateColName = colNames[0] ?? "";
      const countColName = colNames[1] ?? k;
      const currentDate = (row as any)[dateColName];
      const currentCount = Number((row as any)[countColName] ?? 0);
      result[k] = currentDate === today ? currentCount + 1 : 1;
    } else if (strParts.includes("+ 1")) {
      result[k] = current + 1;
    } else {
      result[k] = v; // fallback
    }
  }
  return result as Partial<ProfileRow>;
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
    emailVerifiedAt: { name: "emailVerifiedAt" },
    email: { name: "email" },
    savedProfile: { name: "savedProfile" },
    freeTrialsUsed: { name: "freeTrialsUsed" },
  };
  const documentsTable = {
    __name: "documents",
    id: { name: "id" },
    userId: { name: "userId" },
    coverLetter: { name: "coverLetter" },
    cvHtml: { name: "cvHtml" },
    perfectedGenerationId: { name: "perfectedGenerationId" },
  };
  const perfectedGenerationsTable = {
    __name: "perfected_generations",
    id: { name: "id" },
    userId: { name: "userId" },
    documentId: { name: "documentId" },
    documentType: { name: "documentType" },
    createdAt: { name: "createdAt" },
  };
  const stripeEventsTable = { __name: "stripe_events", id: { name: "id" } };

  /**
   * Build a db-like object operating on mutable profile/state snapshots.
   * `getProfile` / `setProfile` allow the `transaction` wrapper to provide
   * isolated copies that are only committed to real state on success.
   */
  function buildOps(
    getProfile: () => ProfileRow | null,
    setProfile: (p: ProfileRow | null) => void,
    failDocInsert: () => boolean, // returns true once, then false
  ) {
    const ops: any = {
      select: (...args: any[]) => {
        const isCountQuery =
          args.length === 1 && args[0] !== null && typeof args[0] === "object" && "value" in args[0];
        return {
          from: (table: any) => ({
            where: () => {
              if (table === profilesTable) {
                const p = getProfile();
                return {
                  then: (ok: any, err: any) => Promise.resolve(p ? [p] : []).then(ok, err),
                  limit: (n: number) => Promise.resolve(p ? [p].slice(0, n) : []),
                  orderBy: () => Promise.resolve(p ? [p] : []),
                };
              }
              if (isCountQuery) {
                return {
                  then: (ok: any, err: any) => Promise.resolve([{ value: state.docCount }]).then(ok, err),
                };
              }
              return {
                then: (ok: any, err: any) => Promise.resolve([]).then(ok, err),
                limit: () => Promise.resolve([]),
                orderBy: () => ({ limit: () => Promise.resolve([]), then: (ok: any, err: any) => Promise.resolve([]).then(ok, err) }),
              };
            },
            orderBy: () => ({ limit: () => Promise.resolve([]), then: (ok: any, err: any) => Promise.resolve([]).then(ok, err) }),
            limit: () => Promise.resolve([]),
          }),
        };
      },

      update: (table: any) => ({
        set: (patch: any) => ({
          where: (_condition: any) => {
            const p = getProfile();
            if (table !== profilesTable || !p) {
              return {
                returning: (_proj?: any) => Promise.resolve([]),
                then: (ok: any, err: any) => Promise.resolve([]).then(ok, err),
              };
            }

            const today = new Date().toISOString().slice(0, 10);
            const setsDailyPerfect = "dailyPerfectCount" in patch || "dailyPerfectDate" in patch;
            const setsDailyDoc = "dailyDocCount" in patch || "dailyDocDate" in patch;

            // Detect rollback: any update value contains "GREATEST"
            const isRollback = Object.values(patch).some((expr: any) => {
              if (!expr || typeof expr !== "object" || !Array.isArray(expr.queryChunks)) return false;
              return expr.queryChunks
                .filter((c: any) => Array.isArray(c?.value))
                .map((c: any) => String(c.value[0] ?? ""))
                .join("")
                .includes("GREATEST");
            });

            // For Power perfect reservation: enforce both lifetime and daily limits
            if (setsDailyPerfect && !isRollback) {
              const lifetimeOk = (p.perfectCount ?? 0) < 50;
              const dailyOk =
                p.dailyPerfectDate !== today || (p.dailyPerfectCount ?? 0) < 10;
              if (!lifetimeOk || !dailyOk) {
                return {
                  returning: (_proj?: any) => Promise.resolve([]),
                  then: (ok: any, err: any) => Promise.resolve([]).then(ok, err),
                };
              }
            }

            // For Power doc reservation: enforce daily doc limit
            if (setsDailyDoc && !setsDailyPerfect && !isRollback) {
              const dailyOk =
                p.dailyDocDate !== today || (p.dailyDocCount ?? 0) < 10;
              if (!dailyOk) {
                return {
                  returning: (_proj?: any) => Promise.resolve([]),
                  then: (ok: any, err: any) => Promise.resolve([]).then(ok, err),
                };
              }
            }

            // Apply the patch
            const prev = p.perfectCount ?? 0;
            const resolved = resolvePatch(patch, p);
            const updated = { ...p, ...resolved };
            setProfile(updated);

            // Track perfectCount deltas for tests
            if ("perfectCount" in resolved) {
              state.perfectCountDeltas.push(Number(updated.perfectCount) - prev);
            }

            // After a reservation (not rollback), simulate midnight crossing if requested.
            // This changes dailyPerfectDate to a different date so that the upcoming
            // rollback's reservationDate will NOT match the profile's current date.
            if (setsDailyPerfect && !isRollback && state.simulateMidnightCrossing) {
              state.simulateMidnightCrossing = false;
              const newDay = updated;
              newDay.dailyPerfectDate = "2099-12-31"; // far-future date simulating new day
              newDay.dailyPerfectCount = 3;           // 3 uses already on that "new day"
              setProfile({ ...newDay });
            }

            return {
              returning: (_proj?: any) => {
                const latest = getProfile();
                return Promise.resolve(latest ? [latest] : []);
              },
              then: (ok: any, err: any) => {
                const latest = getProfile();
                return Promise.resolve(latest ? [latest] : []).then(ok, err);
              },
            };
          },
        }),
      }),

      insert: (table: any) => ({
        values: (v: any) => ({
          returning: () => {
            if (table === documentsTable) {
              if (failDocInsert()) {
                throw new Error("simulated document insert failure");
              }
              return Promise.resolve([{ id: `doc-${Math.random().toString(36).slice(2)}`, ...v }]);
            }
            if (table === perfectedGenerationsTable) {
              // Allow tests to simulate a transient DB error during generation insert
              if (state.failNextGenInsert) {
                state.failNextGenInsert = false;
                return Promise.reject(new Error("simulated generation insert failure"));
              }
              return Promise.resolve([
                {
                  id: "gen-" + Math.random().toString(36).slice(2),
                  fullText: v.fullText ?? "",
                  previewText: v.previewText ?? "",
                  fullProfile: v.fullProfile ?? null,
                  previewProfile: v.previewProfile ?? null,
                  changes: v.changes ?? [],
                  ...v,
                },
              ]);
            }
            return Promise.resolve([{ id: "gen-1", ...v }]);
          },
          then: (ok: any, err: any) => Promise.resolve([{ id: "gen-1", ...v }]).then(ok, err),
          onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }),
          onConflictDoUpdate: () => ({ then: (ok: any, err: any) => Promise.resolve([]).then(ok, err) }),
        }),
      }),

      delete: () => ({ where: () => Promise.resolve([]) }),
    };

    return ops;
  }

  // Whether the NEXT document insert should fail (consumed once per call)
  function makeFailDocInsertFn() {
    return () => {
      if (state.failNextDocInsert) {
        state.failNextDocInsert = false;
        return true;
      }
      return false;
    };
  }

  const mainOps = buildOps(
    () => state.profile,
    (p) => { state.profile = p; },
    makeFailDocInsertFn(),
  );

  // `transaction`: run `fn` against isolated snapshot; commit on success,
  // discard (rollback) on thrown error.
  mainOps.transaction = async (fn: (tx: any) => Promise<any>) => {
    const snapshot = state.profile ? { ...state.profile } : null;
    let txProfile = snapshot ? { ...snapshot } : null;
    const setTx = (p: ProfileRow | null) => { txProfile = p; };

    const txOps = buildOps(() => txProfile, setTx, makeFailDocInsertFn());

    let result: any;
    try {
      result = await fn(txOps);
    } catch (e) {
      // Rollback: discard snapshot, re-throw so caller sees 500
      throw e;
    }
    // Commit
    state.profile = txProfile;
    return result;
  };

  return {
    db: mainOps,
    pool: {},
    profilesTable,
    documentsTable,
    perfectedGenerationsTable,
    stripeEventsTable,
  };
});

// ---------------------------------------------------------------------------
// Anthropic mock
// ---------------------------------------------------------------------------
const realFetch = global.fetch;
global.fetch = (async (input: any, init?: any) => {
  if (String(input).includes("api.anthropic.com")) {
    state.claudeCallCount++;
    if (state.claudeFailNext) {
      state.claudeFailNext = false;
      return new Response("Internal Server Error", { status: 500 });
    }
    const longLetter =
      "Sehr geehrte Damen und Herren, nach eingehender Analyse meiner " +
      "Erfahrungen im Bereich der Softwareentwicklung bewerbe ich mich " +
      "auf die ausgeschriebene Stelle. Mit freundlichen Grüßen.";
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({ letter: longLetter, changes: ["Verbessert"] }),
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return realFetch(input, init);
}) as typeof fetch;

import app from "../app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const auth = { Authorization: "Bearer test-token" };
const longLetter = "Anschreiben ".repeat(8); // ≥ 80 chars

// ---------------------------------------------------------------------------
// Tests – Lifetime-Limit (50×)
// ---------------------------------------------------------------------------

describe("Power-Plan: Lifetime-Perfektionierungslimit (50×)", () => {
  beforeEach(() => resetState());

  it("unlimited-Nutzer mit perfectCount=49 → 50. Aufruf gelingt (200)", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 49 });
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(200);
    expect(res.body.letter).toBeDefined();
  });

  it("unlimited-Nutzer mit perfectCount=50 → 429 perfect_limit_reached", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 50 });
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("perfect_limit_reached");
  });

  it("perfectCount wird nach erfolgreichem Aufruf um 1 erhöht", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 3 });
    await request(app).post("/api/perfect").set(auth).send({ letterText: longLetter });
    expect(state.profile?.perfectCount).toBe(4);
  });

  it("dailyPerfectCount wird ebenfalls erhöht und dailyPerfectDate gesetzt", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 0,
      dailyPerfectDate: null,
    });
    await request(app).post("/api/perfect").set(auth).send({ letterText: longLetter });
    expect(state.profile?.dailyPerfectDate).toBe(TODAY);
    expect(state.profile?.dailyPerfectCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests – Atomare Reservierung: fehlgeschlagener KI-Aufruf
// ---------------------------------------------------------------------------

describe("Power-Plan: fehlgeschlagener KI-Aufruf verbraucht keinen Zähler", () => {
  beforeEach(() => resetState());

  it("perfectCount bleibt gleich, wenn Claude 500 zurückgibt", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 5 });
    state.claudeFailNext = true;

    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });

    expect(res.status).toBe(503);
    // Net: +1 reserve then -1 rollback = 0
    const net = state.perfectCountDeltas.reduce((s, v) => s + v, 0);
    expect(net).toBe(0);
    expect(state.profile?.perfectCount).toBe(5);
  });

  it("dailyPerfectCount ebenfalls zurückgerollt nach KI-Fehler (gleicher Tag)", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 5,
      dailyPerfectCount: 3,
      dailyPerfectDate: TODAY,
    });
    state.claudeFailNext = true;

    await request(app).post("/api/perfect").set(auth).send({ letterText: longLetter });

    expect(state.profile?.dailyPerfectCount).toBe(3); // unchanged after rollback
  });

  it("Reserve (+1) und Rollback (-1) sind beide verzeichnet", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 10 });
    state.claudeFailNext = true;

    await request(app).post("/api/perfect").set(auth).send({ letterText: longLetter });

    expect(state.perfectCountDeltas).toContain(1);
    expect(state.perfectCountDeltas).toContain(-1);
  });
});

// ---------------------------------------------------------------------------
// Tests – Midnight-Schutz: Rollback dekrementiert nicht den nächsten Tag
// ---------------------------------------------------------------------------

describe("Power-Plan: Rollback nach Mitternacht dekrementiert neuen Tag nicht", () => {
  beforeEach(() => resetState());

  it("dailyPerfectCount des neuen Tages bleibt unverändert, wenn Rollback-Datum nicht übereinstimmt", async () => {
    // Setup: user has some daily usage already (for today, which will be reset when reservation happens)
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 5,
      dailyPerfectCount: 0,
      dailyPerfectDate: null,
    });

    // Enable midnight simulation: after the reservation sets dailyPerfectDate=TODAY,
    // the mock will immediately change it to "2099-12-31" with dailyPerfectCount=3.
    // This simulates another concurrent request creating a new-day entry before
    // our failing request's rollback runs.
    state.simulateMidnightCrossing = true;
    state.claudeFailNext = true;

    await request(app).post("/api/perfect").set(auth).send({ letterText: longLetter });

    // reservationDate was TODAY; dailyPerfectDate is now "2099-12-31" (simulated new day)
    // The rollback's CASE WHEN ("2099-12-31" = TODAY) → false → ELSE branch → no decrement
    expect(state.profile?.dailyPerfectDate).toBe("2099-12-31");
    expect(state.profile?.dailyPerfectCount).toBe(3); // unchanged: new day's count preserved
    // perfectCount should still be rolled back (date guard is only for daily count)
    expect(state.profile?.perfectCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Tests – Fair-Use-Limit (10 perfects / Tag)
// ---------------------------------------------------------------------------

describe("Power-Plan: Fair-Use-Limit (10 Perfektionierungen/Tag)", () => {
  beforeEach(() => resetState());

  it("10 Aufrufe am selben Tag sind alle erlaubt", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 0,
      dailyPerfectCount: 0,
      dailyPerfectDate: null,
    });
    for (let i = 0; i < 10; i++) {
      const r = await request(app)
        .post("/api/perfect")
        .set(auth)
        .send({ letterText: longLetter });
      expect(r.status).toBe(200);
    }
  });

  it("11. Aufruf am selben Tag → 429 daily_limit_reached", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 10,
      dailyPerfectCount: 10,
      dailyPerfectDate: TODAY,
    });
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("daily_limit_reached");
  });

  it("Neuer Tag (dailyPerfectDate aus Vergangenheit) → Zähler wird zurückgesetzt", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 5,
      dailyPerfectCount: 10, // exhausted, but yesterday
      dailyPerfectDate: "2024-01-01",
    });
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(200);
    expect(state.profile?.dailyPerfectDate).toBe(TODAY);
    expect(state.profile?.dailyPerfectCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests – Single-Nutzer (credits=1)
// ---------------------------------------------------------------------------

describe("Single-Plan (credits=1): POST /perfect", () => {
  beforeEach(() => resetState());

  it("Nutzer mit credits=1 und 1 Dokument kann perfect aufrufen", async () => {
    resetState({ isPremium: true, credits: 1, isUnlimited: false }, 1);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(200);
    expect(res.body.letter).toBeDefined();
  });

  it("perfectCount wird für credits-Nutzer NICHT erhöht (kein Power-Plan)", async () => {
    resetState({ isPremium: true, credits: 1, isUnlimited: false, perfectCount: 0 }, 1);
    await request(app).post("/api/perfect").set(auth).send({ letterText: longLetter });
    expect(state.perfectCountDeltas.length).toBe(0);
    expect(state.profile?.perfectCount).toBe(0);
  });

  it("Gratis-Nutzer ohne Dokumente kann perfect aufrufen", async () => {
    resetState({ isPremium: false, credits: 0, isUnlimited: false }, 0);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests – Dokument-Erstellungs-Fair-Use-Limit (10/Tag)
// ---------------------------------------------------------------------------

describe("Power-Plan: Dokument-Erstellungs-Fair-Use-Limit (10/Tag)", () => {
  beforeEach(() => resetState());

  it("Power-Nutzer kann das 11. Dokument insgesamt erstellen (kein Gesamtlimit)", async () => {
    resetState({ isUnlimited: true, isPremium: true, dailyDocCount: 0, dailyDocDate: null });
    const res = await request(app)
      .post("/api/documents")
      .set(auth)
      .send({ name: "Bewerbung 11" });
    expect(res.status).toBe(201);
  });

  it("11. Dokument am selben Tag → 429 daily_document_limit_reached", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      dailyDocCount: 10,
      dailyDocDate: TODAY,
    });
    const res = await request(app)
      .post("/api/documents")
      .set(auth)
      .send({ name: "Bewerbung 11" });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("daily_document_limit_reached");
  });

  it("Neuer Tag setzt Dokumentzähler zurück", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      dailyDocCount: 10,
      dailyDocDate: "2024-01-01",
    });
    const res = await request(app)
      .post("/api/documents")
      .set(auth)
      .send({ name: "Neue Bewerbung" });
    expect(res.status).toBe(201);
    expect(state.profile?.dailyDocDate).toBe(TODAY);
    expect(state.profile?.dailyDocCount).toBe(1);
  });

  it("Nicht-unlimited-Nutzer unterliegen NICHT dem Power-Tageslimit", async () => {
    resetState({ isUnlimited: false, isPremium: true, credits: 1 });
    const res = await request(app)
      .post("/api/documents")
      .set(auth)
      .send({ name: "Normale Bewerbung" });
    expect(res.status).toBe(201);
  });

  it("fehlgeschlagenes Perfektionierungs-Insert rollt Zähler zurück (Power-Slot bleibt frei)", async () => {
    // Regression: if the DB insert for the generation record fails AFTER Claude
    // succeeds, the Power-plan quota slot must be rolled back so the user can retry.
    resetState({
      isUnlimited: true,
      isPremium: true,
      perfectCount: 5,
      dailyPerfectCount: 3,
      dailyPerfectDate: TODAY,
    });
    state.failNextGenInsert = true;

    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });

    // Server returns 500 because the generation could not be persisted
    expect(res.status).toBe(500);

    // Both counters must be rolled back to their pre-request values
    expect(state.profile?.perfectCount).toBe(5);
    expect(state.profile?.dailyPerfectCount).toBe(3);
  });

  it("fehlgeschlagenes Dokument-Insert gibt Tages-Slot zurück (Transaktion rollt zurück)", async () => {
    resetState({
      isUnlimited: true,
      isPremium: true,
      dailyDocCount: 2,
      dailyDocDate: TODAY,
    });

    // Simulate a transient DB error during the document insert (after quota was reserved)
    state.failNextDocInsert = true;

    const res = await request(app)
      .post("/api/documents")
      .set(auth)
      .send({ name: "Fehlschlagendes Dokument" });

    // The server returns 500 because the transaction threw
    expect(res.status).toBe(500);

    // The daily slot must have been rolled back (transaction atomicity):
    // dailyDocCount should still be 2, not 3
    expect(state.profile?.dailyDocCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests – GET /me – perfect_remaining
// ---------------------------------------------------------------------------

describe("GET /me – perfect_remaining", () => {
  beforeEach(() => resetState());

  it("unlimited-Nutzer erhält perfect_remaining = 50 − perfectCount", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 12 });
    const res = await request(app).get("/api/me").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.perfect_remaining).toBe(38);
  });

  it("non-unlimited Nutzer erhält kein perfect_remaining-Feld", async () => {
    resetState({ isUnlimited: false, isPremium: true, credits: 1 });
    const res = await request(app).get("/api/me").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.perfect_remaining).toBeUndefined();
  });

  it("perfect_remaining ist nie negativ (Minimum 0)", async () => {
    resetState({ isUnlimited: true, isPremium: true, perfectCount: 55 });
    const res = await request(app).get("/api/me").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.perfect_remaining).toBe(0);
  });
});
