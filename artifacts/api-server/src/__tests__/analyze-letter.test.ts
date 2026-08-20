import { afterEach, describe, expect, it, vi } from "vitest";
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

const LETTER_TEXT =
  "Sehr geehrte Damen und Herren, ich bewerbe mich mit großem Interesse auf die ausgeschriebene Position. " +
  "Meine Erfahrung im Projektmanagement und meine sorgfältige Arbeitsweise möchte ich in Ihr Team einbringen.";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/analyze for cover letters", () => {
  it("switches Claude to the cover-letter prompt and labels the submitted document correctly", async () => {
    let claudeRequest: Record<string, any> | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      claudeRequest = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({
          score: 8,
          summary: "Individuell und klar formuliert.",
          strengths: ["Konkreter Bezug zur Stelle"],
          improvements: [{ title: "Einstieg", tip: "Noch persönlicher beginnen." }],
        }) }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const response = await request(app)
      .post("/api/analyze")
      .set("Authorization", "Bearer test-token")
      .send({ cvText: LETTER_TEXT, docType: "letter", language: "de" });

    expect(response.status).toBe(200);
    expect(response.body.score).toBe(80);
    expect(claudeRequest?.system).toContain("Das vorliegende Dokument ist ein BEWERBUNGSSCHREIBEN");
    expect(claudeRequest?.system).toContain("Bewerte AUSSCHLIESSLICH das Bewerbungsschreiben");
    expect(claudeRequest?.messages[0].content).toContain(`BEWERBUNG:\n${LETTER_TEXT}`);
    expect(claudeRequest?.messages[0].content).not.toContain("LEBENSLAUF:");
  });
});