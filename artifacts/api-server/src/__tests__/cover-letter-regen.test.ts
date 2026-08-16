/**
 * POST /documents/:id/cover-letter (nachträgliche Anschreiben-Erzeugung):
 * - Ownership: fremde/unbekannte Dokumente → 404, ohne Auth → 401
 * - Fehlendes Anschreiben wird erzeugt und gespeichert
 * - Idempotent: existiert bereits ein Anschreiben, wird es zurückgegeben (keine neue KI-Anfrage)
 * - Parallel-Schutz: gleichzeitige Anfragen auf dasselbe Dokument → 409
 * - Rate-Limit pro Nutzer → 429
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

type DocRow = {
  id: string;
  userId: string;
  name: string;
  template: string;
  cvHtml: string | null;
  coverLetter: string | null;
  profileData: any;
  jobTitle: string | null;
  jobCompany: string | null;
  createdAt: Date;
};

const state = {
  docs: [] as DocRow[],
  claudeCalls: 0,
  claudeDelayMs: 0,
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
  const documentsTable = { __name: "documents", id: {}, userId: {}, coverLetter: {} };
  const profilesTable = { __name: "profiles", userId: {}, credits: {} };
  const stripeEventsTable = { __name: "stripe_events", id: {} };

  // Sehr einfache Fake-DB: Tests halten pro Fall genau die relevanten Dokumente in
  // state.docs; where-Bedingungen werden nicht geparst, gefiltert wird auf den Test-Nutzer.
  function rowsForWhere() {
    return state.docs.filter((d) => d.userId === "user-1");
  }

  const dbLike = {
    select: () => ({
      from: () => ({
        where: () => {
          const rows = rowsForWhere();
          return {
            orderBy: () => Promise.resolve(rows),
            then: (ok: any, err: any) => Promise.resolve(rows).then(ok, err),
          };
        },
      }),
    }),
    update: () => ({
      set: (patch: any) => ({
        where: () => {
          // Die Cover-Letter-Route schreibt konditional (nur wenn noch kein
          // Anschreiben existiert) — das bildet die Fake-DB immer so ab.
          const apply = () => {
            const doc = rowsForWhere()[0];
            if (!doc) return [];
            if (doc.coverLetter && doc.coverLetter.trim() !== "") return [];
            Object.assign(doc, patch);
            return [{ id: doc.id }];
          };
          return {
            returning: () => Promise.resolve(apply()),
            then: (ok: any, err: any) => Promise.resolve(apply()).then(ok, err),
          };
        },
      }),
    }),
    insert: () => ({ values: (v: any) => ({ returning: () => Promise.resolve([v]) }) }),
    transaction: async (fn: any) => fn(dbLike),
  };


  return { db: dbLike, pool: {}, documentsTable, profilesTable, stripeEventsTable };
});

process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";

// Anthropic-HTTP-Aufrufe abfangen
const realFetch = global.fetch;
global.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  if (url.includes("api.anthropic.com")) {
    state.claudeCalls++;
    if (state.claudeDelayMs) await new Promise((r) => setTimeout(r, state.claudeDelayMs));
    return new Response(
      JSON.stringify({ content: [{ type: "text", text: "Sehr geehrte Damen und Herren, ... Mit freundlichen Grüßen" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return realFetch(input, init);
}) as any;

import app from "../app";

function makeDoc(overrides: Partial<DocRow> = {}): DocRow {
  return {
    id: overrides.id ?? "doc-1",
    userId: overrides.userId ?? "user-1",
    name: "Test",
    template: "modern",
    cvHtml: "<div>CV</div>",
    coverLetter: null,
    profileData: {
      personal: { firstName: "Max", lastName: "Muster", city: "Berlin" },
      jobad: {},
      experience: [{ position: "Entwickler", company: "ACME" }],
      skills: [{ name: "TypeScript" }],
      language: "de",
    },
    jobTitle: null,
    jobCompany: null,
    createdAt: new Date("2026-08-13T00:00:00Z"),
    ...overrides,
  };
}

const auth = { Authorization: "Bearer test-token" };

describe("POST /documents/:id/cover-letter", () => {
  beforeEach(() => {
    state.docs = [];
    state.claudeCalls = 0;
    state.claudeDelayMs = 0;
  });

  it("requires auth", async () => {
    const res = await request(app).post("/api/documents/doc-1/cover-letter");
    expect(res.status).toBe(401);
  });

  it("404s for unknown or foreign documents", async () => {
    state.docs = [makeDoc({ id: "doc-x", userId: "someone-else" })];
    const res = await request(app).post("/api/documents/doc-x/cover-letter").set(auth);
    expect(res.status).toBe(404);
    expect(state.claudeCalls).toBe(0);
  });

  it("generates and persists a letter for a document without one", async () => {
    state.docs = [makeDoc({ id: "doc-gen" })];
    const res = await request(app).post("/api/documents/doc-gen/cover-letter").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("Sehr geehrte");
    expect(state.claudeCalls).toBe(1);
    expect(state.docs[0].coverLetter).toBe(res.body.result);
  });

  it("is idempotent: returns the existing letter without a new AI call", async () => {
    state.docs = [makeDoc({ id: "doc-idem", coverLetter: "Bereits vorhanden" })];
    const res = await request(app).post("/api/documents/doc-idem/cover-letter").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("Bereits vorhanden");
    expect(res.body.alreadyExisted).toBe(true);
    expect(state.claudeCalls).toBe(0);
  });

  it("rejects concurrent generation for the same document with 409", async () => {
    state.docs = [makeDoc({ id: "doc-conc" })];
    state.claudeDelayMs = 150;
    const [a, b] = await Promise.all([
      request(app).post("/api/documents/doc-conc/cover-letter").set(auth),
      new Promise((r) => setTimeout(r, 30)).then(() =>
        request(app).post("/api/documents/doc-conc/cover-letter").set(auth),
      ),
    ]);
    const statuses = [a.status, (b as any).status].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
    expect(state.claudeCalls).toBe(1);
  });

  it("rate-limits repeated regeneration attempts per user", async () => {
    // 5 erlaubte Aufrufe (je neues Dokument ohne Anschreiben), der 6. wird begrenzt
    let limited = 0;
    for (let i = 0; i < 7; i++) {
      const id = `doc-rl-${i}`;
      state.docs = [makeDoc({ id })];
      const res = await request(app).post(`/api/documents/${id}/cover-letter`).set(auth);
      if (res.status === 429) limited++;
    }
    expect(limited).toBeGreaterThanOrEqual(1);
    expect(state.claudeCalls).toBeLessThanOrEqual(5);
  });
});
