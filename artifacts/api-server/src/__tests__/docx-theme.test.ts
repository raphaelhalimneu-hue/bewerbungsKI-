/**
 * Verifies that the DOCX export applies the selected template's accent colors
 * (matching the HTML templates in bewerbungski/src/lib/buildCVHTML.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import JSZip from "jszip";

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

const PROFILE_DATA = {
  personal: { firstName: "Max", lastName: "Müller", title: "Mechatroniker", email: "max@example.com", city: "München", summary: "Profil." },
  experience: [],
  education: [],
  skills: [],
  languages: [],
};

const CV_JSON = {
  name: "Max Müller", title: "Mechatroniker", contact: "München · max@example.com",
  profile: "Profil.", experience: [], education: [], skills: [], languages: [], signature: "München, 2026",
};

async function docXml(body: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(body);
  return zip.file("word/document.xml")!.async("string");
}

beforeEach(() => resetStore());

describe("template accent colors in cv.docx (GET, stored template)", () => {
  it.each([
    ["swiss", "DC2626"],
    ["nordic", "0D9488"],
    ["elegant", "92400E"],
    ["compact", "1F2937"],
  ])("template %s → accent %s in document.xml", async (template, accent) => {
    const doc = seedDoc({ name: "Test", template, profileData: PROFILE_DATA, coverLetter: "Hallo", cvHtml: "<div/>" });
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cv.docx`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((r, cb) => { const chunks: Buffer[] = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    const xml = await docXml(res.body as Buffer);
    expect(xml).toContain(accent);
  });

  it("unknown template falls back to default theme", async () => {
    const doc = seedDoc({ name: "Test", template: "does-not-exist", profileData: PROFILE_DATA, coverLetter: null, cvHtml: "<div/>" });
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cv.docx`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((r, cb) => { const chunks: Buffer[] = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    const xml = await docXml(res.body as Buffer);
    expect(xml).toContain("1F2937"); // DEFAULT_THEME accent
  });
});

describe("template accent colors in cv.docx (POST, editor flow)", () => {
  it("uses template from request body over stored template", async () => {
    const doc = seedDoc({ name: "Test", template: "modern", profileData: PROFILE_DATA, coverLetter: null, cvHtml: "<div/>" });
    const res = await request(app)
      .post(`/api/documents/${doc.id}/download/cv.docx`)
      .set("Authorization", "Bearer test-token")
      .send({ cv_json: CV_JSON, template: "timeline" })
      .buffer(true)
      .parse((r, cb) => { const chunks: Buffer[] = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    const xml = await docXml(res.body as Buffer);
    expect(xml).toContain("EA580C"); // timeline orange, not modern's default
  });
});

describe("cover-letter.docx theming", () => {
  it("name header uses template accent color", async () => {
    const doc = seedDoc({ name: "Test", template: "corporate", profileData: PROFILE_DATA, coverLetter: "Sehr geehrte Damen und Herren,\n\nText.", cvHtml: "<div/>" });
    const res = await request(app)
      .get(`/api/documents/${doc.id}/download/cover-letter.docx`)
      .set("Authorization", "Bearer test-token")
      .buffer(true)
      .parse((r, cb) => { const chunks: Buffer[] = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    const xml = await docXml(res.body as Buffer);
    expect(xml).toContain("065F46"); // corporate green
  });
});
