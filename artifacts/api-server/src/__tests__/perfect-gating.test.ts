import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const FULL_TEXT = Array.from(
  { length: 90 },
  (_, index) => `verbesserter-${index + 1}`,
).join(" ");
const FULL_PROFILE = Array.from(
  { length: 30 },
  (_, index) => `profil-${index + 1}`,
).join(" ");

const state = {
  profile: {
    userId: "user-1",
    email: "test@example.com",
    isPremium: false,
    credits: 0,
    isUnlimited: false,
    perfectCount: 0,
    emailVerifiedAt: new Date(),
  },
  generations: [] as any[],
  documents: [] as any[],
  modelLetter: FULL_TEXT,
  modelProfile: FULL_PROFILE,
  modelChanges: ["Klarer formuliert", "Erfolge konkretisiert"],
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
        getUser: async (token: string) =>
          token === "test-token" || token === "owner-token"
            ? { data: { user: { id: "user-1", email: token === "owner-token" ? "halimraphael9@gmail.com" : "test@example.com" } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
    },
  }),
}));

vi.mock("@workspace/db", () => {
  const profilesTable = {
    __name: "profiles",
    userId: {},
    perfectCount: {},
    credits: {},
  };
  const documentsTable = {
    __name: "documents",
    id: {},
    userId: {},
    perfectedLetter: {},
    perfectedGenerationId: {},
  };
  const perfectedGenerationsTable = {
    __name: "perfected_generations",
    id: {},
    userId: {},
    documentId: {},
    documentType: {},
    fullText: {},
    createdAt: {},
  };
  const stripeEventsTable = { __name: "stripe_events", id: {} };

  function selectRows(table: any) {
    if (table === profilesTable) return [state.profile];
    if (table === perfectedGenerationsTable) return state.generations;
    if (table === documentsTable) return state.documents;
    return [];
  }

  function queryChain(rows: any[]) {
    const promise = () => Promise.resolve(rows);
    const limited = {
      limit: () => promise(),
      then: (ok: any, err: any) => promise().then(ok, err),
    };
    return {
      orderBy: () => limited,
      limit: () => promise(),
      then: (ok: any, err: any) => promise().then(ok, err),
    };
  }

  const db = {
    select: (selection?: Record<string, unknown>) => ({
      from: (table: any) => ({
        where: () => queryChain(
          table === documentsTable && selection && "value" in selection
            ? [{ value: state.documents.length }]
            : selectRows(table),
        ),
      }),
    }),
    insert: (table: any) => ({
      values: (value: any) => ({
        returning: async () => {
          if (table !== perfectedGenerationsTable) return [value];
          const generation = {
            id: "11111111-1111-4111-8111-111111111111",
            ...value,
            createdAt: new Date(),
          };
          state.generations = [generation, ...state.generations];
          return [generation];
        },
      }),
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => ({
          returning: async () => {
            if (table === documentsTable && state.documents[0]) {
              state.documents[0] = { ...state.documents[0], ...values };
              return [state.documents[0]];
            }
            return [];
          },
          then: (ok: any, err: any) => {
            if (table === documentsTable && state.documents[0]) {
              state.documents[0] = { ...state.documents[0], ...values };
            }
            return Promise.resolve([]).then(ok, err);
          },
        }),
      }),
    }),
    transaction: async (callback: any) => callback(db),
  };

  return {
    db,
    pool: {},
    profilesTable,
    documentsTable,
    perfectedGenerationsTable,
    stripeEventsTable,
  };
});

process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";

const realFetch = global.fetch;
global.fetch = (async (input: any, init?: any) => {
  if (String(input).includes("api.anthropic.com")) {
    return new Response(
      JSON.stringify({
        content: [{
          type: "text",
          text: JSON.stringify({
            letter: state.modelLetter,
            profile: state.modelProfile,
            changes: state.modelChanges,
          }),
        }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return realFetch(input, init);
}) as any;

import app from "../app";

const auth = { Authorization: "Bearer test-token" };
const ownerAuth = { Authorization: "Bearer owner-token" };

describe("perfected text preview gating", () => {
  beforeEach(() => {
    state.profile.isPremium = false;
    state.profile.credits = 0;
    state.profile.perfectCount = 0;
    state.generations = [];
    state.documents = [];
    state.modelLetter = FULL_TEXT;
    state.modelProfile = FULL_PROFILE;
    state.modelChanges = ["Klarer formuliert", "Erfolge konkretisiert"];
  });

  it("never returns the full generated text to a free account", async () => {
    const response = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({
        letterText: "Ausgangstext ".repeat(20),
        profileText: "Profiltext ".repeat(10),
        docType: "letter",
        language: "de",
      });

    expect(response.status).toBe(200);
    expect(response.body.locked).toBe(true);
    expect(response.body.preview).toContain("[…]");
    expect(response.body.preview).not.toBe(FULL_TEXT);
    expect(response.body).not.toHaveProperty("letter");
    expect(response.body).not.toHaveProperty("profile");
    expect(response.body).not.toHaveProperty("changes");
    expect(JSON.stringify(response.body)).not.toContain(FULL_TEXT);
    expect(JSON.stringify(response.body)).not.toContain(FULL_PROFILE);
  });

  it("grants unlimited access only to the exact owner profile", async () => {
    const response = await request(app)
      .post("/api/perfect")
      .set(ownerAuth)
      .send({
        letterText: "Ausgangstext ".repeat(20),
        docType: "letter",
        language: "de",
      });

    expect(response.status).toBe(200);
    expect(response.body.locked).toBe(false);
    expect(response.body.letter).toBe(FULL_TEXT);
  });

  it("blocks the full-text route until the server sees a purchase", async () => {
    const created = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({
        letterText: "Ausgangstext ".repeat(20),
        docType: "cv",
        language: "de",
      });
    const generationId = created.body.generationId;

    const blocked = await request(app)
      .get(`/api/perfect/${generationId}/full`)
      .set(auth);
    expect(blocked.status).toBe(402);
    expect(blocked.body).not.toHaveProperty("letter");

    state.profile.isPremium = true;
    state.profile.credits = 10;
    const unlocked = await request(app)
      .get(`/api/perfect/${generationId}/full`)
      .set(auth);
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.locked).toBe(false);
    expect(unlocked.body.letter).toBe(FULL_TEXT);
  });

  it("returns only the persisted preview after a free-account reload", async () => {
    await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({
        letterText: "Ausgangstext ".repeat(20),
        docType: "cv",
        language: "de",
      });

    const latest = await request(app).get("/api/perfect/latest?type=cv").set(auth);
    expect(latest.status).toBe(200);
    expect(latest.body.locked).toBe(true);
    expect(latest.body.preview).toContain("[…]");
    expect(latest.body).not.toHaveProperty("letter");
  });

  it("blocks document retrieval for a free account after its application is saved", async () => {
    const documentId = "22222222-2222-4222-8222-222222222222";
    state.documents = [{
      id: documentId,
      userId: "user-1",
      name: "Testbewerbung",
      template: "modern",
      cvHtml: "<div>Original CV</div>",
      coverLetter: "Originale Bewerbung",
      perfectedLetter: FULL_TEXT,
      perfectedCvHtml: `<div>${FULL_PROFILE}</div>`,
      perfectedGenerationId: "11111111-1111-4111-8111-111111111111",
      profileData: { cv_json: { profile: "Originalprofil" } },
      jobTitle: null,
      jobCompany: null,
      createdAt: new Date(),
    }];
    state.generations = [{
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      documentId,
      documentType: "letter",
      fullText: FULL_TEXT,
      previewText: "gekürzte sichere Vorschau […]",
      fullProfile: FULL_PROFILE,
      previewProfile: "gekürztes Profil […]",
      changes: [],
      createdAt: new Date(),
    }];

    const freeResponse = await request(app)
      .get(`/api/documents/${documentId}`)
      .set(auth);
    expect(freeResponse.status).toBe(403);
    expect(freeResponse.body.error).toBe("upgrade_required");

    state.profile.isPremium = true;
    state.profile.credits = 10;
    const paidResponse = await request(app)
      .get(`/api/documents/${documentId}`)
      .set(auth);
    expect(paidResponse.status).toBe(200);
    expect(paidResponse.body.perfected_locked).toBe(false);
    expect(paidResponse.body.perfected_letter).toBeNull();
    expect(paidResponse.body.perfected_profile).toBeNull();
    expect(paidResponse.body.cover_letter).toBe(FULL_TEXT);
    expect(paidResponse.body.profile_data.cv_json.profile).toBe(FULL_PROFILE);
  });

  it("also blocks access to legacy documents for a locked free account", async () => {
    const documentId = "33333333-3333-4333-8333-333333333333";
    state.documents = [{
      id: documentId,
      userId: "user-1",
      name: "Ältere Bewerbung",
      template: "modern",
      cvHtml: "<div>Original CV</div>",
      coverLetter: FULL_TEXT,
      perfectedLetter: null,
      perfectedCvHtml: null,
      perfectedGenerationId: null,
      profileData: { cv_json: { profile: "Originalprofil" } },
      jobTitle: null,
      jobCompany: null,
      createdAt: new Date(),
    }];
    state.generations = [{
      id: "44444444-4444-4444-8444-444444444444",
      userId: "user-1",
      documentId,
      documentType: "letter",
      fullText: FULL_TEXT,
      previewText: "sichere nachträgliche Vorschau […]",
      fullProfile: null,
      previewProfile: null,
      changes: [],
      createdAt: new Date(),
    }];

    const response = await request(app).get(`/api/documents/${documentId}`).set(auth);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("upgrade_required");
  });

  it("keeps one-token model output and changes from leaking through a locked payload", async () => {
    state.modelLetter = "L".repeat(240);
    state.modelProfile = "P".repeat(160);
    state.modelChanges = [state.modelLetter, state.modelProfile];

    const response = await request(app)
      .post("/api/perfect")
      .set(auth)
      .send({
        letterText: "Ausgangstext ".repeat(20),
        profileText: "Profiltext ".repeat(10),
        docType: "letter",
        language: "de",
      });

    expect(response.status).toBe(200);
    expect(response.body.locked).toBe(true);
    expect(response.body.preview).toContain("[…]");
    expect(response.body.preview.length).toBeLessThan(state.modelLetter.length);
    expect(response.body.profilePreview.length).toBeLessThan(state.modelProfile.length);
    expect(response.body).not.toHaveProperty("changes");
    expect(JSON.stringify(response.body)).not.toContain(state.modelLetter);
    expect(JSON.stringify(response.body)).not.toContain(state.modelProfile);
  });
});