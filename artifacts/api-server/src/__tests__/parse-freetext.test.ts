/**
 * Tests for POST /api/parse-freetext (free-text CV import):
 *   - 401 without auth
 *   - 400 for too-short text
 *   - success: Anthropic response is normalized into the profile structure
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

const LONG_TEXT =
  "Ich heiße Max Müller, komme aus München und habe von 2016 bis 2019 eine Ausbildung " +
  "zum KFZ-Mechatroniker gemacht. Seit 2019 arbeite ich bei Bosch in Stuttgart. " +
  "Ich möchte mich als Mechatroniker bei der Auto AG bewerben.";

const MODEL_JSON = {
  personal: {
    firstName: "Max", lastName: "Müller", title: "KFZ-Mechatroniker",
    email: "", phone: "", address: "", zip: "", city: "München",
    linkedin: "", website: "", summary: "Erfahrener Mechatroniker.",
  },
  experience: [
    { company: "Bosch", city: "Stuttgart", position: "Mechatroniker", start: "2019-03", end: "", current: true, description: "Wartung und Instandhaltung" },
  ],
  education: [
    { institution: "BS München", city: "München", degree: "Ausbildung zum KFZ-Mechatroniker", field: "", grade: "", start: "2016-09", end: "2019-02" },
    // The model sometimes puts the school diploma into education — normalize() must move it to `school`.
    { institution: "Realschule München", city: "München", degree: "Realschulabschluss", field: "", grade: "2,1", start: "2010-09", end: "2016-07" },
  ],
  skills: [
    { name: "Wartung & Instandhaltung", level: 90 },
    { name: "Diagnose", level: "not-a-number" }, // must be normalized to default 80
  ],
  languages: [{ language: "Deutsch", level: "Muttersprache" }, { language: "" }],
  school: { type: "", name: "", city: "", year: "" },
  jobad: { title: "Mechatroniker", company: "Auto AG", address: "", description: "" },
};

function mockAnthropicFetch(payload: unknown = MODEL_JSON, wrap = (s: string) => s) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
    if (String(url).includes("api.anthropic.com")) {
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: wrap(JSON.stringify(payload)) }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/parse-freetext", () => {
  it("401 without auth token", async () => {
    const res = await request(app).post("/api/parse-freetext").send({ text: LONG_TEXT });
    expect(res.status).toBe(401);
  });

  it("401 with an invalid token", async () => {
    const res = await request(app)
      .post("/api/parse-freetext")
      .set("Authorization", "Bearer wrong-token")
      .send({ text: LONG_TEXT });
    expect(res.status).toBe(401);
  });

  it("400 for too-short text", async () => {
    const res = await request(app)
      .post("/api/parse-freetext")
      .set("Authorization", "Bearer test-token")
      .send({ text: "zu kurz" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("text_too_short");
  });

  it("400 for missing text", async () => {
    const res = await request(app)
      .post("/api/parse-freetext")
      .set("Authorization", "Bearer test-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("text_too_short");
  });

  it("success: returns the normalized profile structure", async () => {
    mockAnthropicFetch();
    const res = await request(app)
      .post("/api/parse-freetext")
      .set("Authorization", "Bearer test-token")
      .send({ text: LONG_TEXT });

    expect(res.status).toBe(200);
    const d = res.body.data;

    // personal
    expect(d.personal.firstName).toBe("Max");
    expect(d.personal.lastName).toBe("Müller");
    expect(d.personal.city).toBe("München");

    // experience
    expect(d.experience).toHaveLength(1);
    expect(d.experience[0]).toMatchObject({ company: "Bosch", position: "Mechatroniker", current: true });

    // school diploma moved out of education into `school`
    expect(d.education).toHaveLength(1);
    expect(d.education[0].degree).toBe("Ausbildung zum KFZ-Mechatroniker");
    expect(d.school).toMatchObject({ type: "Realschulabschluss", name: "Realschule München", year: "2016" });

    // skills: invalid level normalized to 80
    expect(d.skills).toEqual([
      { name: "Wartung & Instandhaltung", level: 90 },
      { name: "Diagnose", level: 80 },
    ]);

    // languages: empty entries dropped
    expect(d.languages).toEqual([{ language: "Deutsch", level: "Muttersprache" }]);

    // jobad detected
    expect(d.jobad).toMatchObject({ title: "Mechatroniker", company: "Auto AG" });
  });

  it("success: strips markdown code fences from the model output", async () => {
    mockAnthropicFetch(MODEL_JSON, (s) => "```json\n" + s + "\n```");
    const res = await request(app)
      .post("/api/parse-freetext")
      .set("Authorization", "Bearer test-token")
      .send({ text: LONG_TEXT });
    expect(res.status).toBe(200);
    expect(res.body.data.personal.firstName).toBe("Max");
  });

  it("500 parse_failed when the model returns invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "keine JSON Antwort" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const res = await request(app)
      .post("/api/parse-freetext")
      .set("Authorization", "Bearer test-token")
      .send({ text: LONG_TEXT });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("parse_failed");
  });
});
