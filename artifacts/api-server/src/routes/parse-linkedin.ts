import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Simple per-user rate limit: max 5 imports per 15 minutes (in-memory).
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;
const rateMap = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) { rateMap.set(userId, hits); return true; }
  hits.push(now);
  rateMap.set(userId, hits);
  return false;
}

// ── Server-side normalization of model output ──────────────────────────────
const str = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, 30) : []);

function normalize(raw: any) {
  const p = raw?.personal ?? {};
  return {
    personal: {
      firstName: str(p.firstName, 80), lastName: str(p.lastName, 80), title: str(p.title, 120),
      email: str(p.email, 120), phone: str(p.phone, 60), address: str(p.address, 160),
      zip: str(p.zip, 20), city: str(p.city, 80), linkedin: str(p.linkedin, 200),
      website: str(p.website, 200), summary: str(p.summary, 2000),
    },
    experience: arr(raw?.experience).map((e: any) => ({
      company: str(e?.company, 160), city: str(e?.city, 80), position: str(e?.position, 160),
      start: str(e?.start, 10), end: str(e?.end, 10), current: e?.current === true,
      description: str(e?.description, 2000),
    })).filter(e => e.company || e.position),
    skills: arr(raw?.skills).map((s: any) => ({
      name: str(s?.name, 80),
      level: typeof s?.level === "number" && s.level >= 0 && s.level <= 100 ? Math.round(s.level) : 80,
    })).filter(s => s.name),
    languages: arr(raw?.languages).map((l: any) => ({
      language: str(l?.language, 60), level: str(l?.level, 30) || "B2",
    })).filter(l => l.language),
    ...(() => {
      const sc = raw?.school ?? {};
      let school = { type: str(sc?.type, 80), name: str(sc?.name, 160), city: str(sc?.city, 80), year: str(sc?.year, 10) };
      // Safety net: the model often puts the school diploma into education despite instructions.
      // Detect such entries, move the first one into `school`, and drop them from education.
      const isSchool = (deg: string) => /abitur|fachabitur|realschul|hauptschul|mittlere reife|schulabschluss|hochschulreife|fachoberschulreife|quali\b/i.test(deg);
      const edu = arr(raw?.education).map((e: any) => ({
        institution: str(e?.institution, 160), city: str(e?.city, 80), degree: str(e?.degree, 160),
        field: str(e?.field, 160), grade: str(e?.grade, 40), start: str(e?.start, 10), end: str(e?.end, 10),
      })).filter(e => e.institution || e.degree);
      const schoolEntries = edu.filter(e => isSchool(e.degree));
      if (!school.type && !school.name && schoolEntries.length) {
        const e = schoolEntries[0];
        school = { type: e.degree, name: e.institution, city: e.city, year: e.end.slice(0, 4) || e.start.slice(0, 4) };
      }
      const ja = raw?.jobad ?? {};
      const jobad = { title: str(ja?.title, 160), company: str(ja?.company, 160), address: str(ja?.address, 240), description: str(ja?.description, 4000) };
      return {
        education: edu.filter(e => !isSchool(e.degree)),
        ...(school.type || school.name ? { school } : {}),
        ...(jobad.title || jobad.company ? { jobad } : {}),
      };
    })(),
  };
}

router.post("/parse-linkedin", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (rateLimited(req.userId!)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const { text } = req.body as { text: string };
    if (!text || typeof text !== "string" || text.trim().length < 50) {
      res.status(400).json({ error: "text_too_short" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI not configured" });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        system:
          'Du extrahierst Lebenslaufdaten aus kopiertem LinkedIn-Profiltext. Antworte AUSSCHLIESSLICH mit validem JSON (kein Markdown, keine Erklärungen) in exakt dieser Struktur: {"personal":{"firstName":"","lastName":"","title":"","email":"","phone":"","address":"","zip":"","city":"","linkedin":"","website":"","summary":""},"experience":[{"company":"","city":"","position":"","start":"JJJJ-MM","end":"JJJJ-MM","current":false,"description":""}],"education":[{"institution":"","city":"","degree":"","field":"","grade":"","start":"JJJJ-MM","end":"JJJJ-MM"}],"skills":[{"name":"","level":80}],"languages":[{"language":"","level":"B2"}],"school":{"type":"","name":"","city":"","year":"JJJJ"},"jobad":{"title":"","company":"","address":"","description":""}}. Regeln: Wenn der Text eine angestrebte Stelle/Bewerbung erwähnt (z.B. "ich bewerbe mich als X bei Y"), fülle "jobad" (title=Stelle, company=Unternehmen, address=Adresse des Unternehmens falls genannt, description=Details zur Stelle); sonst alle jobad-Felder leer lassen. Der allgemeinbildende Schulabschluss (Hauptschulabschluss, Realschulabschluss/Mittlere Reife, Abitur, Fachabitur o.ä.) gehört in "school" (type=Abschlussart, name=Schulname, year=Abschlussjahr) und NICHT in "education"; "education" ist nur für Berufsausbildung/Studium/Weiterbildung. Eine Berufsausbildung/Lehre MUSS immer als education-Eintrag erscheinen (degree z.B. "Ausbildung zum KFZ-Mechatroniker") und NICHT stattdessen nur unter experience. Fehlende Felder als leerer String. Daten im Format JJJJ-MM (bei nur Jahr: JJJJ-01). Bei aktueller Stelle current=true und end="". Sprachniveau als A1-C2 oder "Muttersprache". Beschreibungen kurz zusammenfassen. Behalte die Originalsprache der Inhalte bei.',
        messages: [{ role: "user", content: `Extrahiere die Lebenslaufdaten aus diesem LinkedIn-Profiltext:\n\n${text.slice(0, 20000)}` }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Claude parse-linkedin error");
      res.status(500).json({ error: "parse_failed" });
      return;
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    let raw = data.content?.find((b) => b.type === "text")?.text ?? "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      req.log.error({ raw: raw.slice(0, 500) }, "parse-linkedin: invalid JSON from model");
      res.status(500).json({ error: "parse_failed" });
      return;
    }
    res.json({ data: normalize(parsed) });
  } catch (err) {
    req.log.error({ err }, "POST /parse-linkedin error");
    res.status(500).json({ error: "parse_failed" });
  }
});

// ── Free-text CV parsing: user writes about themselves in plain language ─────
router.post("/parse-freetext", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (rateLimited(req.userId!)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    const { text } = req.body as { text: string };
    if (!text || typeof text !== "string" || text.trim().length < 30) {
      res.status(400).json({ error: "text_too_short" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI not configured" });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        system:
          'Ein Bewerber beschreibt seinen Werdegang in eigenen Worten (formlos, umgangssprachlich, unvollständig). Extrahiere und strukturiere die Lebenslaufdaten. Antworte AUSSCHLIESSLICH mit validem JSON (kein Markdown, keine Erklärungen) in exakt dieser Struktur: {"personal":{"firstName":"","lastName":"","title":"","email":"","phone":"","address":"","zip":"","city":"","linkedin":"","website":"","summary":""},"experience":[{"company":"","city":"","position":"","start":"JJJJ-MM","end":"JJJJ-MM","current":false,"description":""}],"education":[{"institution":"","city":"","degree":"","field":"","grade":"","start":"JJJJ-MM","end":"JJJJ-MM"}],"skills":[{"name":"","level":80}],"languages":[{"language":"","level":"B2"}],"school":{"type":"","name":"","city":"","year":"JJJJ"},"jobad":{"title":"","company":"","address":"","description":""}}. Regeln: Wenn der Text eine angestrebte Stelle/Bewerbung erwähnt (z.B. "ich bewerbe mich als X bei Y" oder "ich möchte mich als X bewerben"), fülle "jobad" (title=Stelle, company=Unternehmen, address=Adresse des Unternehmens falls genannt, description=Details zur Stelle); sonst alle jobad-Felder leer lassen. Der allgemeinbildende Schulabschluss (Hauptschulabschluss, Realschulabschluss/Mittlere Reife, Abitur, Fachabitur o.ä.) gehört in "school" (type=Abschlussart, name=Schulname, year=Abschlussjahr) und NICHT in "education"; "education" ist nur für Berufsausbildung/Studium/Weiterbildung. Eine Berufsausbildung/Lehre MUSS immer als education-Eintrag erscheinen (degree z.B. "Ausbildung zum KFZ-Mechatroniker"). Fehlende Felder als leerer String — NIEMALS Daten erfinden. Ungefähre Zeitangaben ("vor 5 Jahren", "seit 2020") in JJJJ-MM umrechnen (heute ist ' + new Date().toISOString().slice(0, 7) + '). Bei nur Jahr: JJJJ-01. Bei aktueller Stelle current=true und end="". Formulierungen professionalisieren (z.B. "hab bei Bosch geschraubt" → position "Mechaniker", description professionell). Skills aus dem Text ableiten (auch implizite: wer als Mechaniker arbeitete hat "Wartung & Instandhaltung"). Sprachniveau als A1-C2 oder "Muttersprache". Behalte die Sprache des Bewerbertextes bei.',
        messages: [{ role: "user", content: `Strukturiere diesen formlosen Werdegang zu Lebenslaufdaten. WICHTIG: Fülle ALLE passenden Bereiche — school (Schulabschluss), education (Berufsausbildung/Studium als eigene Einträge), experience, skills, languages und jobad (falls eine angestrebte Stelle/Firma erwähnt wird):\n\n${text.slice(0, 20000)}` }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Claude parse-freetext error");
      res.status(500).json({ error: "parse_failed" });
      return;
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    let raw = data.content?.find((b) => b.type === "text")?.text ?? "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      req.log.error({ raw: raw.slice(0, 500) }, "parse-freetext: invalid JSON from model");
      res.status(500).json({ error: "parse_failed" });
      return;
    }
    res.json({ data: normalize(parsed) });
  } catch (err) {
    req.log.error({ err }, "POST /parse-freetext error");
    res.status(500).json({ error: "parse_failed" });
  }
});

export default router;
