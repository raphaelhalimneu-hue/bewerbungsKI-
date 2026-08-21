import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

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

vi.mock("@workspace/db", async () => {
  const { fakeDb, fakeTables } = await import("./helpers/fake-db");
  return { db: fakeDb, ...fakeTables, pool: {} };
});

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import app from "../app";
import { resetStore, seedDoc, store } from "./helpers/fake-db";

beforeEach(() => {
  resetStore();
  // Preview edits are paid-only, matching the production PATCH guard.
  store.profile.credits = 1;
});

describe("PATCH /api/documents/:id", () => {
  it("returns 404 instead of dereferencing a missing document", async () => {
    const response = await request(app)
      .get("/api/documents/missing")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it("persists compact-preview CV and cover-letter edits for the next reload", async () => {
    const doc = seedDoc({
      bezahlt: true,
      cvHtml: "<div>Alter Lebenslauf</div>",
      coverLetter: "Altes Anschreiben",
      profileData: {
        cv_json: { name: "Max Müller", experience: [] },
        language: "de",
      },
    });

    const editedCvHtml = "<div><h1>Neuer Lebenslauf</h1><p>Gespeicherte Änderung</p></div>";
    const editedLetter = "Sehr geehrte Damen und Herren,\n\nmein gespeichertes Anschreiben.";
    const patch = await request(app)
      .patch(`/api/documents/${doc.id}`)
      .set("Authorization", "Bearer test-token")
      .send({ cv_html: editedCvHtml, cover_letter: editedLetter });

    expect(patch.status).toBe(200);
    expect(store.docs[0].cvHtml).toBe(editedCvHtml);
    expect(store.docs[0].coverLetter).toBe(editedLetter);
    expect(store.docs[0].profileData).toMatchObject({
      previewCvHtmlEdited: true,
      cv_json: { name: "Max Müller", experience: [] },
    });

    const reloaded = await request(app)
      .get(`/api/documents/${doc.id}`)
      .set("Authorization", "Bearer test-token");

    expect(reloaded.status).toBe(200);
    expect(reloaded.body.cv_html).toBe(editedCvHtml);
    expect(reloaded.body.cover_letter).toBe(editedLetter);
    expect(reloaded.body.cv_json).toEqual({ name: "Max Müller", experience: [] });
  });

  it("keeps surrounding profile data when structured CV JSON is saved", async () => {
    const doc = seedDoc({
      bezahlt: true,
      cvHtml: "<div>Lebenslauf</div>",
      profileData: {
        language: "de",
        personal: { firstName: "Max", lastName: "Müller" },
        cv_json: { name: "Max Müller", experience: [] },
        previewCvHtmlEdited: true,
      },
    });
    const editedCvJson = {
      name: "Max Mustermann",
      title: "Vertrieb",
      experience: [],
      education: [],
      skills: [],
      languages: [],
    };

    const patch = await request(app)
      .patch(`/api/documents/${doc.id}`)
      .set("Authorization", "Bearer test-token")
      .send({ cv_json: editedCvJson });

    expect(patch.status).toBe(200);
    expect(store.docs[0].profileData).toMatchObject({
      language: "de",
      personal: { firstName: "Max", lastName: "Müller" },
      cv_json: editedCvJson,
      previewCvHtmlEdited: false,
    });
  });

  it("removes executable markup while retaining safe CV formatting", async () => {
    const doc = seedDoc({ bezahlt: true, cvHtml: "<p>Alt</p>" });
    const patch = await request(app)
      .patch(`/api/documents/${doc.id}`)
      .set("Authorization", "Bearer test-token")
      .send({
        cv_html: '<div class="cv-head" style="color: #123456" onclick="alert(1)"><h1>Max</h1><img src="x" onerror="alert(2)"><script>alert(3)</script><a href="javascript:alert(4)">Link</a></div>',
      });

    expect(patch.status).toBe(200);
    expect(store.docs[0].cvHtml).toContain('<div class="cv-head" style="color: #123456">');
    expect(store.docs[0].cvHtml).toContain("<h1>Max</h1>");
    expect(store.docs[0].cvHtml).not.toMatch(/script|onerror|onclick|javascript:/i);
  });
});