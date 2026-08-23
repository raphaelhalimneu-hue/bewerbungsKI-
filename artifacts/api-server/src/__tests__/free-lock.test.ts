/**
 * isFreeQuotaLocked – Gratis-Nutzer-Sperre
 *
 * Prüft, dass die Sperre:
 *  1. Gratis-Nutzer mit 1 Dokument auf POST /analyze, POST /perfect und
 *     PATCH /documents/:id mit 403 upgrade_required blockiert.
 *  2. Gratis-Nutzer mit 0 Dokumenten NICHT blockiert.
 *  3. Nutzer mit credits > 0 NICHT blockiert.
 *  4. isPremium-Nutzer NICHT blockiert.
 *  5. isUnlimited-Nutzer (UNLIMITED_EMAILS-Kategorie) NICHT blockiert.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

type ProfileState = {
  isPremium: boolean;
  isUnlimited: boolean;
  credits: number;
  emailVerifiedAt: Date | null;
};

const state = {
  docCount: 0,
  docs: [] as { id: string; userId: string; profileData?: any }[],
  profile: {
    isPremium: false,
    isUnlimited: false,
    credits: 0,
    emailVerifiedAt: new Date(),
  } as ProfileState,
};

function resetState(profileOverrides: Partial<ProfileState> = {}, docCount = 0) {
  state.docCount = docCount;
  state.docs = docCount > 0 ? [{ id: "doc-1", userId: "user-1", profileData: {} }] : [];
  state.profile = {
    isPremium: false,
    isUnlimited: false,
    credits: 0,
    emailVerifiedAt: new Date(),
    ...profileOverrides,
  };
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
  const profilesTable = { __name: "profiles", userId: {}, emailVerifiedAt: {}, isPremium: {}, isUnlimited: {}, credits: {} };
  const documentsTable = { __name: "documents", id: {}, userId: {}, coverLetter: {}, cvHtml: {}, perfectedGenerationId: {} };
  const perfectedGenerationsTable = { __name: "perfected_generations", id: {}, userId: {}, documentId: {}, documentType: {}, createdAt: {} };

  const dbLike: any = {
    select: (...args: any[]) => {
      // count() query: first arg is { value: <sql expression> }
      const isCountQuery =
        args.length === 1 &&
        args[0] !== null &&
        typeof args[0] === "object" &&
        "value" in args[0];

      return {
        from: (table: any) => ({
          where: () => {
            if (table === profilesTable) {
              return {
                then: (ok: any, err: any) => Promise.resolve([state.profile]).then(ok, err),
                orderBy: () => Promise.resolve([state.profile]),
                limit: () => Promise.resolve([state.profile]),
              };
            }
            if (isCountQuery) {
              // count() for documentsTable
              return {
                then: (ok: any, err: any) =>
                  Promise.resolve([{ value: state.docCount }]).then(ok, err),
              };
            }
            // Regular doc rows (used by the PATCH 404-check, GET, etc.)
            return {
              then: (ok: any, err: any) => Promise.resolve(state.docs).then(ok, err),
              limit: (n: number) => ({
                then: (ok: any, err: any) =>
                  Promise.resolve(state.docs.slice(0, n)).then(ok, err),
              }),
            };
          },
          orderBy: () => ({
            limit: (n: number) => Promise.resolve(state.docs.slice(0, n)),
            then: (ok: any, err: any) => Promise.resolve(state.docs).then(ok, err),
          }),
          limit: (n: number) => Promise.resolve(state.docs.slice(0, n)),
        }),
      };
    },

    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(state.docs.slice(0, 1)),
          then: (ok: any, err: any) =>
            Promise.resolve(state.docs.slice(0, 1)).then(ok, err),
        }),
      }),
    }),

    insert: () => ({
      values: (v: any) => ({
        returning: () =>
          Promise.resolve([
            {
              id: "gen-1",
              fullText: v.fullText ?? "",
              previewText: v.previewText ?? "",
              fullProfile: v.fullProfile ?? null,
              previewProfile: v.previewProfile ?? null,
              changes: v.changes ?? [],
              ...v,
            },
          ]),
        then: (ok: any, err: any) =>
          Promise.resolve([{ id: "gen-1", ...v }]).then(ok, err),
      }),
    }),
  };

  return {
    db: dbLike,
    pool: {},
    profilesTable,
    documentsTable,
    perfectedGenerationsTable,
  };
});

vi.mock("../lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

// Anthropic API mock – returns a valid response for both /analyze and /perfect.
const realFetch = global.fetch;
global.fetch = (async (input: any, init?: any) => {
  if (String(input).includes("api.anthropic.com")) {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const isAnalyze = String(body.system ?? "").includes("ATS-System");
    if (isAnalyze) {
      return new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                score: 8,
                summary: "Gut",
                strengths: ["Klar"],
                improvements: [],
              }),
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // perfect
    const longEnoughLetter =
      "Sehr geehrte Damen und Herren, nach eingehender Analyse meiner " +
      "Erfahrungen im Bereich der Softwareentwicklung bewerbe ich mich " +
      "auf die ausgeschriebene Stelle. Mit freundlichen Grüßen.";
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({ letter: longEnoughLetter, changes: ["Verbessert"] }),
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
// Minimum 80 chars of CV text required by POST /analyze
const longCv = "Lebenslauf ".repeat(10);
// Minimum 80 chars of letter text required by POST /perfect
const longLetter = "Anschreiben ".repeat(8);

// ---------------------------------------------------------------------------
// Tests – POST /analyze
// ---------------------------------------------------------------------------

describe("isFreeQuotaLocked — POST /analyze", () => {
  beforeEach(() => resetState());

  it("blockiert Gratis-Nutzer mit 1 Dokument → 403 upgrade_required", async () => {
    resetState({}, 1);
    const res = await request(app)
      .post("/api/analyze")
      .set(auth)
      .send({ cvText: longCv });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("upgrade_required");
  });

  it("erlaubt Gratis-Nutzer ohne Dokument", async () => {
    resetState({}, 0);
    const res = await request(app)
      .post("/api/analyze")
      .set(auth)
      .send({ cvText: longCv });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt Nutzer mit credits > 0", async () => {
    resetState({ credits: 5 }, 1);
    const res = await request(app)
      .post("/api/analyze")
      .set(auth)
      .send({ cvText: longCv });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt isPremium-Nutzer", async () => {
    resetState({ isPremium: true }, 1);
    const res = await request(app)
      .post("/api/analyze")
      .set(auth)
      .send({ cvText: longCv });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt isUnlimited-Nutzer (UNLIMITED_EMAILS-Kategorie)", async () => {
    resetState({ isUnlimited: true }, 1);
    const res = await request(app)
      .post("/api/analyze")
      .set(auth)
      .send({ cvText: longCv });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests – POST /perfect
// ---------------------------------------------------------------------------

describe("isFreeQuotaLocked — POST /perfect", () => {
  beforeEach(() => resetState());

  it("blockiert Gratis-Nutzer mit 1 Dokument → 403 upgrade_required", async () => {
    resetState({}, 1);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("upgrade_required");
  });

  it("erlaubt Gratis-Nutzer ohne Dokument", async () => {
    resetState({}, 0);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt Nutzer mit credits > 0", async () => {
    resetState({ credits: 1 }, 1);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt isPremium-Nutzer", async () => {
    resetState({ isPremium: true }, 1);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt isUnlimited-Nutzer (UNLIMITED_EMAILS-Kategorie)", async () => {
    resetState({ isUnlimited: true }, 1);
    const res = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({ letterText: longLetter });
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests – PATCH /documents/:id
// ---------------------------------------------------------------------------

describe("isFreeQuotaLocked — PATCH /documents/:id", () => {
  beforeEach(() => resetState());

  it("blockiert Gratis-Nutzer mit 1 Dokument bei Inhalts-Edit → 403 upgrade_required", async () => {
    resetState({}, 1);
    const res = await request(app)
      .patch("/api/documents/doc-1")
      .set(auth)
      .send({ cover_letter: "Sehr geehrte Damen und Herren" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("upgrade_required");
  });

  it("Gratis-Nutzer mit 0 Dokumenten → 404 (kein Dokument zum Bearbeiten, kein 403)", async () => {
    resetState({}, 0);
    const res = await request(app)
      .patch("/api/documents/doc-1")
      .set(auth)
      .send({ cover_letter: "Sehr geehrte Damen und Herren" });
    // No document → 404, not 403; free user is not incorrectly blocked
    expect(res.status).toBe(404);
  });

  it("erlaubt Nutzer mit credits > 0", async () => {
    resetState({ credits: 3 }, 1);
    const res = await request(app)
      .patch("/api/documents/doc-1")
      .set(auth)
      .send({ cover_letter: "Sehr geehrte Damen und Herren" });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt isPremium-Nutzer", async () => {
    resetState({ isPremium: true }, 1);
    const res = await request(app)
      .patch("/api/documents/doc-1")
      .set(auth)
      .send({ cover_letter: "Sehr geehrte Damen und Herren" });
    expect(res.status).not.toBe(403);
  });

  it("erlaubt isUnlimited-Nutzer (UNLIMITED_EMAILS-Kategorie)", async () => {
    resetState({ isUnlimited: true }, 1);
    const res = await request(app)
      .patch("/api/documents/doc-1")
      .set(auth)
      .send({ cover_letter: "Sehr geehrte Damen und Herren" });
    expect(res.status).not.toBe(403);
  });

  it("blockiert NICHT, wenn nur template geändert wird (kein Inhalts-Edit)", async () => {
    // Free user with 1 doc, but only changing template → no lock check
    resetState({}, 1);
    const res = await request(app)
      .patch("/api/documents/doc-1")
      .set(auth)
      .send({ template: "classic" });
    // Template-only patch does not trigger the lock; it should succeed
    expect(res.status).not.toBe(403);
  });
});
