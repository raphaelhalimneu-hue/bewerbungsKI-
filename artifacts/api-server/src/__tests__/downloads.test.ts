/**
 * Regression tests for the 4 download routes:
 *   GET /api/documents/:id/download/cv.docx
 *   GET /api/documents/:id/download/cover-letter.docx
 *   GET /api/documents/:id/download/cv.pdf
 *   GET /api/documents/:id/download/cover-letter.pdf
 *
 * These downloads once returned 500 for weeks because of a special character
 * (en dash) in the filename — every test here uses a document name containing
 * an en dash, umlauts, and an emoji to lock that fix in.
 */
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
import { resetStore, seedDoc } from "./helpers/fake-db";

const TRICKY_NAME = "Bewerbung – Müller & Söhne 🚀";

const PROFILE_DATA = {
  personal: {
    firstName: "Max",
    lastName: "Müller",
    title: "KFZ-Mechatroniker",
    email: "max@example.com",
    phone: "+49 170 1234567",
    city: "München",
    summary: "Erfahrener Mechatroniker mit Leidenschaft für Technik.",
  },
  experience: [
    {
      company: "Bosch GmbH",
      city: "Stuttgart",
      position: "Mechatroniker",
      start: "2019-03",
      end: "",
      current: true,
      description: "Wartung und Instandhaltung\nQualitätskontrolle",
    },
  ],
  education: [
    { institution: "BS München", city: "München", degree: "Ausbildung", field: "KFZ", start: "2016-09", end: "2019-02" },
  ],
  skills: [{ name: "Wartung", level: 90 }],
  languages: [{ language: "Deutsch", level: "Muttersprache" }],
};

const COVER_LETTER = "Sehr geehrte Damen und Herren,\n\nhiermit bewerbe ich mich.\n\nMit freundlichen Grüßen\nMax Müller";
const CV_HTML = `<div style="font-family:Arial"><h1>Max Müller</h1><p>Lebenslauf – Test</p></div>`;

function seedFullDoc() {
  return seedDoc({
    name: TRICKY_NAME,
    profileData: PROFILE_DATA,
    coverLetter: COVER_LETTER,
    cvHtml: CV_HTML,
  });
}

/** Content-Disposition must be pure ASCII, otherwise Express throws a 500. */
function expectAsciiDisposition(res: request.Response) {
  const cd = res.headers["content-disposition"];
  expect(cd).toBeTruthy();
  expect(/^[\x20-\x7E]*$/.test(cd)).toBe(true);
  expect(cd).toContain("attachment");
  expect(cd).toContain("filename*=UTF-8''");
}

beforeEach(() => {
  resetStore();
});

describe("auth", () => {
  it.each([
    "/api/documents/some-id/download/cv.docx",
    "/api/documents/some-id/download/cover-letter.docx",
    "/api/documents/some-id/download/cv.pdf",
    "/api/documents/some-id/download/cover-letter.pdf",
  ])("GET %s without token → 401", async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
  });
});

describe("404 for unknown document", () => {
  it.each([
    "/api/documents/missing/download/cv.docx",
    "/api/documents/missing/download/cover-letter.docx",
    "/api/documents/missing/download/cv.pdf",
    "/api/documents/missing/download/cover-letter.pdf",
  ])("GET %s → 404", async (url) => {
    const res = await request(app).get(url).set("Authorization", "Bearer test-token");
    expect(res.status).toBe(404);
  });
});

describe("downloads with special characters in document name", () => {
  it("cv.docx → 200, valid DOCX, ASCII-safe headers", async () => {
    const doc = seedFullDoc();
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cv.docx`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("officedocument.wordprocessingml");
    expectAsciiDisposition(res);
    const body = res.body as Buffer;
    expect(body.length).toBeGreaterThan(1000);
    // DOCX files are ZIP archives → magic bytes "PK"
    expect(body.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("cover-letter.docx → 200, valid DOCX, ASCII-safe headers", async () => {
    const doc = seedFullDoc();
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cover-letter.docx`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("officedocument.wordprocessingml");
    expectAsciiDisposition(res);
    const body = res.body as Buffer;
    expect(body.length).toBeGreaterThan(1000);
    expect(body.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("cv.pdf → 200, valid PDF, ASCII-safe headers", async () => {
    const doc = seedFullDoc();
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cv.pdf`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expectAsciiDisposition(res);
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("cover-letter.pdf → 200, valid PDF, ASCII-safe headers", async () => {
    const doc = seedFullDoc();
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cover-letter.pdf`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expectAsciiDisposition(res);
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("cv.pdf → 404 when no cvHtml is stored", async () => {
    const doc = seedDoc({ name: TRICKY_NAME, profileData: PROFILE_DATA, cvHtml: null });
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cv.pdf`)
      .set("Authorization", "Bearer test-token");
    expect(res.status).toBe(404);
  });

  it("cover-letter.pdf → 404 when no cover letter is stored", async () => {
    const doc = seedDoc({ name: TRICKY_NAME, profileData: PROFILE_DATA, coverLetter: "" });
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cover-letter.pdf`)
      .set("Authorization", "Bearer test-token");
    expect(res.status).toBe(404);
  });
});
