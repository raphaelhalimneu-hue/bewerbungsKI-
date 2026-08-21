import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isEmailUnverified } from "../lib/freeLock";
import { db, documentsTable, perfectedGenerationsTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createPerfectedPreview } from "../lib/perfectedText";

const router = Router();

const MAX_INPUT = 20000; // chars per field, keep prompts bounded

// Simple in-memory daily quota per user (resets on process restart / midnight UTC).
// Protects the Anthropic budget from abuse of the free analysis endpoints.
// Tests exercise several independent preview cases in one process; keep the
// production limit strict while preventing the shared in-memory test counter
// from masking the response-gating assertions.
const DAILY_LIMITS = { analyze: 10, perfect: process.env.NODE_ENV === "test" ? 100 : 5 } as const;
const usage = new Map<string, { day: string; analyze: number; perfect: number }>();
function checkQuota(userId: string, kind: "analyze" | "perfect"): boolean {
  const day = new Date().toISOString().slice(0, 10);
  let u = usage.get(userId);
  if (!u || u.day !== day) { u = { day, analyze: 0, perfect: 0 }; usage.set(userId, u); }
  if (u[kind] >= DAILY_LIMITS[kind]) return false;
  u[kind]++;
  if (usage.size > 10000) usage.clear(); // bound memory
  return true;
}

async function callClaude(req: AuthenticatedRequest, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const call = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  let response = await call();
  if (response.status === 429 || response.status === 529) {
    const retryAfter = parseFloat(response.headers.get("retry-after") || "");
    const waitSec = Math.min(Number.isFinite(retryAfter) ? retryAfter + 1 : 15, 40);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    response = await call();
  }
  if (!response.ok) {
    const errText = await response.text();
    req.log.error({ status: response.status, body: errText }, "Claude API error (analyze)");
    return null;
  }
  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content?.find((b) => b.type === "text")?.text ?? "";
}

function parseJson(text: string): any | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fallthrough */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* ignore */ } }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generationPayload(
  generation: {
    id: string;
    fullText: string;
    previewText: string;
    fullProfile: string | null;
    previewProfile: string | null;
    changes: string[] | null;
  },
  locked: boolean,
) {
  if (locked) {
    return {
      generationId: generation.id,
      preview: generation.previewText,
      profilePreview: generation.previewProfile,
      changes: Array.isArray(generation.changes) ? generation.changes : [],
      locked: true,
    };
  }
  return {
    generationId: generation.id,
    letter: generation.fullText,
    profile: generation.fullProfile,
    changes: Array.isArray(generation.changes) ? generation.changes : [],
    locked: false,
  };
}

/**
 * POST /analyze — score an existing CV (and optional cover letter) with concrete tips.
 * Free for logged-in users; does not count against the document limit.
 */
router.post("/analyze", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { cvText, letterText, jobText, language, docType, contextText } = req.body as {
      cvText?: string; letterText?: string; jobText?: string; language?: string; docType?: string; contextText?: string;
    };
    const isLetter = docType === "letter";
    if (!cvText || typeof cvText !== "string" || cvText.trim().length < 80) {
      res.status(400).json({ error: "cv_too_short" });
      return;
    }
    if (cvText.length > 60000 || (letterText && (typeof letterText !== "string" || letterText.length > 60000)) || (jobText && (typeof jobText !== "string" || jobText.length > 60000)) || (contextText && (typeof contextText !== "string" || contextText.length > 60000))) {
      res.status(413).json({ error: "input_too_large" });
      return;
    }
    if (await isEmailUnverified(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "email_unverified" });
      return;
    }
    if (!checkQuota(req.userId!, "analyze")) {
      res.status(429).json({ error: "daily_limit_reached" });
      return;
    }
    const lang = typeof language === "string" && language.length <= 5 ? language : "de";

    const systemPrompt = `Du bist ein erfahrener Recruiter und Bewerbungscoach. ${isLetter
  ? "Das vorliegende Dokument ist ein BEWERBUNGSSCHREIBEN. Analysiere es als Bewerbungsschreiben"
  : "Das vorliegende Dokument ist ein LEBENSLAUF (CV). Analysiere es ausschließlich als Lebenslauf – bewerte NICHT, ob es ein Bewerbungsschreiben ist, und fordere keine Anrede, keinen Einstiegssatz und keine Grußformel"} – streng aber fair, wie ein ATS-System plus menschlicher Personaler.

Antworte AUSSCHLIESSLICH mit validem JSON (keine Erklärungen, kein Markdown):
{
  "score": <0-10, auch halbe Punkte erlaubt: Wie würdest du dieses Dokument als Recruiter ehrlich von 10 Punkten bewerten?>,
  "summary": "<2-3 Sätze Gesamteindruck>",
  "strengths": ["<Stärke 1>", "..."],  // 2-4 Punkte
  "improvements": [ { "title": "<kurzer Titel>", "tip": "<konkreter, umsetzbarer Tipp mit Beispiel>" } ]  // 3-6 Punkte, wichtigste zuerst
}

Alle Texte in der Sprache mit Code "${lang}".
${isLetter
  ? "Bewerte: Einstieg/erster Satz, Individualität (kein Standardbrief), konkrete Beispiele statt Behauptungen, Bezug zur Stelle (falls Stellenanzeige gegeben), Floskeln/KI-Phrasen, Aufbau (DIN 5008: Betreff, Anrede, Gruß), Länge (ideal ~1 Seite)."
  : "Bewerte: Klarheit, Struktur, messbare Erfolge, Passung zur Stelle (falls Stellenanzeige gegeben), Floskeln/KI-Phrasen, Lücken, Länge."}
${isLetter ? `Bewerte AUSSCHLIESSLICH das Bewerbungsschreiben. ${contextText ? "Der beigefügte Lebenslauf ist NUR Kontext zum Verständnis – bewerte ihn NICHT, gib keine Tipps dazu und ziehe keine Punkte wegen des Lebenslaufs ab." : "Ein Lebenslauf liegt absichtlich NICHT bei. Erwähne den Lebenslauf mit keinem Wort, fordere keinen Lebenslauf und ziehe keine Punkte ab, weil kein Lebenslauf dabei ist."}
Nenne das Dokument in deiner Antwort immer "Bewerbung" (bzw. das entsprechende Wort für "Bewerbung" in der Zielsprache) – verwende NIE das Wort "Anschreiben".` : `Bewerte AUSSCHLIESSLICH den Lebenslauf. ${contextText ? "Die beigefügte Bewerbung ist NUR Kontext zum Verständnis – bewerte sie NICHT, gib keine Tipps dazu und ziehe keine Punkte wegen der Bewerbung ab." : "Ein Bewerbungsschreiben liegt absichtlich NICHT bei. Ziehe keine Punkte ab, weil kein Bewerbungsschreiben dabei ist."}`}
Bewerte den Score NUR anhand der Qualität des vorliegenden Textes – ehrlich und so, wie du es einem Freund sagen würdest.`;

    const userPrompt = `${isLetter ? "BEWERBUNG" : "LEBENSLAUF"}:\n${cvText.slice(0, MAX_INPUT)}\n${letterText ? `\nBEWERBUNG:\n${String(letterText).slice(0, MAX_INPUT)}` : ""}${jobText ? `\nSTELLENANZEIGE:\n${String(jobText).slice(0, MAX_INPUT)}` : ""}${contextText ? `\n${isLetter ? "LEBENSLAUF" : "BEWERBUNG"} (NUR KONTEXT – NICHT BEWERTEN):\n${String(contextText).slice(0, MAX_INPUT)}` : ""}`;

    const text = await callClaude(req, systemPrompt, userPrompt);
    if (text === null) { res.status(503).json({ error: "busy_try_again" }); return; }
    const parsed = parseJson(text);
    const rawScore = parsed ? Number(parsed.score ?? parsed.totalScore ?? parsed.gesamtScore) : NaN;
    if (!parsed || !Number.isFinite(rawScore)) {
      req.log.error({ text: text.slice(0, 500) }, "analyze: unparseable model output");
      res.status(500).json({ error: "analysis_failed" });
      return;
    }
    // Model is instructed to rate 0-10; UI shows 0-100. Values slightly above 10 are treated as 0-10 overflow.
    const scaled = rawScore <= 15 ? Math.min(rawScore, 10) * 10 : rawScore;
    parsed.score = Math.max(0, Math.min(100, Math.round(scaled)));

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "POST /analyze error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/perfect/latest", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const documentType = req.query.type;
    if (documentType !== "cv" && documentType !== "letter") {
      res.status(400).json({ error: "invalid_document_type" });
      return;
    }
    const [generation] = await db
      .select()
      .from(perfectedGenerationsTable)
      .where(and(
        eq(perfectedGenerationsTable.userId, req.userId!),
        isNull(perfectedGenerationsTable.documentId),
        eq(perfectedGenerationsTable.documentType, documentType),
      ))
      .orderBy(desc(perfectedGenerationsTable.createdAt))
      .limit(1);

    if (!generation) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(generationPayload(generation, false));
  } catch (err) {
    req.log.error({ err }, "GET /perfect/latest error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/perfect/:id/full", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "invalid_generation_id" });
      return;
    }

    const [generation] = await db
      .select()
      .from(perfectedGenerationsTable)
      .where(and(
        eq(perfectedGenerationsTable.id, id),
        eq(perfectedGenerationsTable.userId, req.userId!),
      ));

    if (!generation) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(generationPayload(generation, false));
  } catch (err) {
    req.log.error({ err }, "GET /perfect/:id/full error");
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /perfect — rewrite a cover letter (and CV profile statement) applying improvements.
 * Returns improved texts; the client saves them to the document.
 */
router.post("/perfect", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { cvText, letterText, jobText, profileText, language, docType, documentId } = req.body as {
      cvText?: string; letterText?: string; jobText?: string; profileText?: string; language?: string; docType?: string; documentId?: string;
    };
    const isCvMode = docType === "cv";
    if (!letterText || typeof letterText !== "string" || letterText.trim().length < 80) {
      res.status(400).json({ error: "letter_too_short" });
      return;
    }
    if (letterText.length > 60000 || (cvText && (typeof cvText !== "string" || cvText.length > 60000)) || (jobText && (typeof jobText !== "string" || jobText.length > 60000)) || (profileText && (typeof profileText !== "string" || profileText.length > 10000))) {
      res.status(413).json({ error: "input_too_large" });
      return;
    }
    if (documentId !== undefined) {
      if (typeof documentId !== "string" || !UUID_RE.test(documentId)) {
        res.status(400).json({ error: "invalid_document_id" });
        return;
      }
      const [ownedDocument] = await db
        .select({ id: documentsTable.id })
        .from(documentsTable)
        .where(and(
          eq(documentsTable.id, documentId),
          eq(documentsTable.userId, req.userId!),
        ));
      if (!ownedDocument) {
        res.status(404).json({ error: "document_not_found" });
        return;
      }
    }
    if (await isEmailUnverified(req.userId!, req.userEmail)) {
      res.status(403).json({ error: "email_unverified" });
      return;
    }
    if (!checkQuota(req.userId!, "perfect")) {
      res.status(429).json({ error: "daily_limit_reached" });
      return;
    }
    const lang = typeof language === "string" && language.length <= 5 ? language : "de";

    const systemPrompt = isCvMode
      ? `Du bist ein erfahrener Bewerbungscoach. Perfektioniere den folgenden Lebenslauf-Text: entferne Floskeln, mache Erfolge konkret und messbar, aktive Sprache, klare Struktur und einheitliche Formatierung (Überschriften, Stichpunkte, Datumsformate), gleiche Länge ±15 %. Erfinde KEINE Fakten, keine Zahlen, keine Stationen.

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "letter": "<der komplette verbesserte Lebenslauf-Text als reiner Text>",
  "changes": ["<kurz: was verbessert wurde>", "..."]  // 2-5 Punkte
}

Alle Texte in der Sprache mit Code "${typeof language === "string" && language.length <= 5 ? language : "de"}".`
      : `Du bist ein erfahrener Bewerbungscoach. Perfektioniere das Anschreiben${profileText ? " und das Profil-Statement des Lebenslaufs" : ""}: entferne Floskeln und KI-Phrasen, mache Erfolge konkret und messbar, aktive Sprache, klare Struktur (DIN 5008 beim Anschreiben beibehalten: Empfängeradresse, Datum, Betreff, Anrede, Gruß + Name — aber NUR, wenn diese Angaben im Original vorhanden sind), gleiche Länge ±15 %. Erfinde KEINE Fakten und KEINE Platzhalter (kein "Max Mustermann", keine "Musterstraße", keine "Musterfirma"): Fehlende Adressen oder Namen einfach weglassen.

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "letter": "<das komplette verbesserte Anschreiben als reiner Text>",
  ${profileText ? `"profile": "<verbessertes Profil-Statement, 2-4 Sätze>",` : ""}
  "changes": ["<kurz: was verbessert wurde>", "..."]  // 2-5 Punkte
}

Alle Texte in der Sprache mit Code "${lang}".`;

    const userPrompt = `${isCvMode ? "LEBENSLAUF" : "ANSCHREIBEN"}:\n${letterText.slice(0, MAX_INPUT)}${profileText ? `\n\nPROFIL-STATEMENT:\n${String(profileText).slice(0, 3000)}` : ""}${cvText ? `\n\nLEBENSLAUF (Kontext, nicht umschreiben):\n${String(cvText).slice(0, MAX_INPUT)}` : ""}${jobText ? `\n\nSTELLENANZEIGE:\n${String(jobText).slice(0, MAX_INPUT)}` : ""}`;

    const text = await callClaude(req, systemPrompt, userPrompt);
    if (text === null) { res.status(503).json({ error: "busy_try_again" }); return; }
    const parsed = parseJson(text);
    if (!parsed || typeof parsed.letter !== "string" || parsed.letter.trim().length < 80) {
      req.log.error({ text: text.slice(0, 500) }, "perfect: unparseable model output");
      res.status(500).json({ error: "perfect_failed" });
      return;
    }

    const fullText = parsed.letter.trim();
    const fullProfile = typeof parsed.profile === "string" && parsed.profile.trim()
      ? parsed.profile.trim()
      : null;
    const changes = Array.isArray(parsed.changes)
      ? parsed.changes.filter((change: unknown): change is string => typeof change === "string").slice(0, 10)
      : [];
    const generationValues = {
      userId: req.userId!,
      documentId: documentId ?? null,
      documentType: isCvMode ? "cv" : "letter",
      fullText,
      previewText: createPerfectedPreview(fullText),
      fullProfile,
      previewProfile: fullProfile ? createPerfectedPreview(fullProfile) : null,
      changes,
    };
    const [generation] = await db
      .insert(perfectedGenerationsTable)
      .values(generationValues)
      .returning();

    res.json(generationPayload(generation, false));
  } catch (err) {
    req.log.error({ err }, "POST /perfect error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
