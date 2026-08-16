import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

const MAX_INPUT = 20000; // chars per field, keep prompts bounded

// Simple in-memory daily quota per user (resets on process restart / midnight UTC).
// Protects the Anthropic budget from abuse of the free analysis endpoints.
const DAILY_LIMITS = { analyze: 10, perfect: 5 } as const;
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
    const unlimitedA = (process.env.UNLIMITED_EMAILS || "halimraphael9@gmail.com").toLowerCase().split(",").includes((req.userEmail || "").toLowerCase());
    if (!unlimitedA && !checkQuota(req.userId!, "analyze")) {
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

/**
 * POST /perfect — rewrite a cover letter (and CV profile statement) applying improvements.
 * Returns improved texts; the client saves them to the document.
 */
router.post("/perfect", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { cvText, letterText, jobText, profileText, language } = req.body as {
      cvText?: string; letterText?: string; jobText?: string; profileText?: string; language?: string;
    };
    if (!letterText || typeof letterText !== "string" || letterText.trim().length < 80) {
      res.status(400).json({ error: "letter_too_short" });
      return;
    }
    if (letterText.length > 60000 || (cvText && (typeof cvText !== "string" || cvText.length > 60000)) || (jobText && (typeof jobText !== "string" || jobText.length > 60000)) || (profileText && (typeof profileText !== "string" || profileText.length > 10000))) {
      res.status(413).json({ error: "input_too_large" });
      return;
    }
    const unlimitedP = (process.env.UNLIMITED_EMAILS || "halimraphael9@gmail.com").toLowerCase().split(",").includes((req.userEmail || "").toLowerCase());
    if (!unlimitedP && !checkQuota(req.userId!, "perfect")) {
      res.status(429).json({ error: "daily_limit_reached" });
      return;
    }
    const lang = typeof language === "string" && language.length <= 5 ? language : "de";

    const systemPrompt = `Du bist ein erfahrener Bewerbungscoach. Perfektioniere das Anschreiben${profileText ? " und das Profil-Statement des Lebenslaufs" : ""}: entferne Floskeln und KI-Phrasen, mache Erfolge konkret und messbar, aktive Sprache, klare Struktur (DIN 5008 beim Anschreiben beibehalten: Empfängeradresse, Datum, Betreff, Anrede, Gruß + Name), gleiche Länge ±15 %. Erfinde KEINE Fakten.

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "letter": "<das komplette verbesserte Anschreiben als reiner Text>",
  ${profileText ? `"profile": "<verbessertes Profil-Statement, 2-4 Sätze>",` : ""}
  "changes": ["<kurz: was verbessert wurde>", "..."]  // 2-5 Punkte
}

Alle Texte in der Sprache mit Code "${lang}".`;

    const userPrompt = `ANSCHREIBEN:\n${letterText.slice(0, MAX_INPUT)}${profileText ? `\n\nPROFIL-STATEMENT:\n${String(profileText).slice(0, 3000)}` : ""}${cvText ? `\n\nLEBENSLAUF (Kontext, nicht umschreiben):\n${String(cvText).slice(0, MAX_INPUT)}` : ""}${jobText ? `\n\nSTELLENANZEIGE:\n${String(jobText).slice(0, MAX_INPUT)}` : ""}`;

    const text = await callClaude(req, systemPrompt, userPrompt);
    if (text === null) { res.status(503).json({ error: "busy_try_again" }); return; }
    const parsed = parseJson(text);
    if (!parsed || typeof parsed.letter !== "string" || parsed.letter.trim().length < 80) {
      req.log.error({ text: text.slice(0, 500) }, "perfect: unparseable model output");
      res.status(500).json({ error: "perfect_failed" });
      return;
    }
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "POST /perfect error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
