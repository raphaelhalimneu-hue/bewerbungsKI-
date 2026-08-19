import { Router } from "express";
import { db, documentsTable, perfectedGenerationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { requireVerifiedEmail } from "../middlewares/verified";
import { isFreeAccount } from "../lib/freeLock";
import { sendEmail } from "../lib/email";
import { buildDocumentEmail } from "../lib/emailTemplates";
import { createPerfectedPreview } from "../lib/perfectedText";

const router = Router();

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function replaceProfileText(cvHtml: string | null, oldProfile: string, newProfile: string): string | null {
  if (!cvHtml || !oldProfile) return cvHtml;
  const escapedOld = escapeHtmlText(oldProfile);
  const escapedNew = escapeHtmlText(newProfile);
  if (cvHtml.includes(escapedOld)) return cvHtml.replace(escapedOld, escapedNew);
  if (cvHtml.includes(oldProfile)) return cvHtml.replace(oldProfile, escapedNew);
  return cvHtml;
}

router.get("/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const docs = await db
      .select({
        id: documentsTable.id,
        name: documentsTable.name,
        template: documentsTable.template,
        job_title: documentsTable.jobTitle,
        job_company: documentsTable.jobCompany,
        created_at: documentsTable.createdAt,
        ats_score: sql`${documentsTable.profileData}->'atsScore'`,
        has_cover_letter: sql<boolean>`(${documentsTable.coverLetter} IS NOT NULL AND ${documentsTable.coverLetter} != '')`,
      })
      .from(documentsTable)
      .where(eq(documentsTable.userId, req.userId!))
      .orderBy(desc(documentsTable.createdAt));

    res.json(docs);
  } catch (err) {
    req.log.error({ err }, "GET /documents error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/documents/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rawId = req.params.id;
    const documentId = Array.isArray(rawId) ? rawId[0] : rawId;
    let [doc] = await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.id, documentId),
          eq(documentsTable.userId, req.userId!)
        )
      );

    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const freeAccount = await isFreeAccount(req.userId!, req.userEmail);
    let [pendingGeneration] = doc.perfectedGenerationId
      ? await db
          .select()
          .from(perfectedGenerationsTable)
          .where(and(
            eq(perfectedGenerationsTable.id, doc.perfectedGenerationId),
            eq(perfectedGenerationsTable.documentId, doc.id),
            eq(perfectedGenerationsTable.userId, req.userId!),
          ))
          .limit(1)
      : [undefined];

    // Before server-side preview gating existed, an allowlisted account could
    // save a perfected result into cover_letter. If that account is now free,
    // recover the matching persisted generation and treat it as locked instead
    // of exposing the same full text as if it were the user's original.
    if (freeAccount && !pendingGeneration && doc.coverLetter) {
      const [legacyGeneration] = await db
        .select()
        .from(perfectedGenerationsTable)
        .where(and(
          eq(perfectedGenerationsTable.documentId, doc.id),
          eq(perfectedGenerationsTable.userId, req.userId!),
          eq(perfectedGenerationsTable.documentType, "letter"),
          eq(perfectedGenerationsTable.fullText, doc.coverLetter),
        ))
        .orderBy(desc(perfectedGenerationsTable.createdAt))
        .limit(1);
      if (legacyGeneration) pendingGeneration = legacyGeneration;
    }

    // A verified buyer atomically promotes the exact pending generation. The
    // conditional marker prevents concurrent GETs from applying a different
    // generation or replaying an already-promoted result.
    if (!freeAccount && pendingGeneration && doc.perfectedGenerationId) {
      const currentProfileData = (doc.profileData as any) || {};
      const currentCvJson = currentProfileData.cv_json || null;
      const oldProfile = typeof currentCvJson?.profile === "string" ? currentCvJson.profile : "";
      const promotedProfileData = pendingGeneration.fullProfile && currentCvJson
        ? {
            ...currentProfileData,
            cv_json: { ...currentCvJson, profile: pendingGeneration.fullProfile },
          }
        : currentProfileData;
      const promotedCvHtml = pendingGeneration.fullProfile && oldProfile
        ? replaceProfileText(doc.cvHtml, oldProfile, pendingGeneration.fullProfile)
        : doc.cvHtml;
      const [promoted] = await db
        .update(documentsTable)
        .set({
          coverLetter: pendingGeneration.fullText,
          cvHtml: promotedCvHtml,
          profileData: promotedProfileData,
          perfectedLetter: null,
          perfectedCvHtml: null,
          perfectedGenerationId: null,
        })
        .where(and(
          eq(documentsTable.id, doc.id),
          eq(documentsTable.userId, req.userId!),
          eq(documentsTable.perfectedGenerationId, pendingGeneration.id),
        ))
        .returning();
      if (promoted) doc = promoted;
    } else if (!freeAccount && doc.perfectedLetter && !doc.perfectedGenerationId) {
      // Legacy perfected copies predate generation IDs. Promote them once for
      // existing buyers while keeping the new ID-bound path strict.
      const [promoted] = await db
        .update(documentsTable)
        .set({
          coverLetter: doc.perfectedLetter,
          cvHtml: doc.perfectedCvHtml || doc.cvHtml,
          perfectedLetter: null,
          perfectedCvHtml: null,
        })
        .where(and(
          eq(documentsTable.id, doc.id),
          eq(documentsTable.userId, req.userId!),
        ))
        .returning();
      if (promoted) doc = promoted;
    }

    // The generation relation is the source of truth for locked content.
    // Do not use the legacy copy as the lock signal: it can be absent on an
    // interrupted/older write even though the full generation is still linked.
    const hasLockedGeneration = freeAccount && Boolean(pendingGeneration);
    const storedPerfectedLetter = doc.perfectedLetter;
    const visiblePerfectedLetter = hasLockedGeneration
      ? (pendingGeneration?.previewText || createPerfectedPreview(storedPerfectedLetter || ""))
      : null;
    const visiblePerfectedProfile = hasLockedGeneration && pendingGeneration?.fullProfile
      ? (pendingGeneration.previewProfile || createPerfectedPreview(pendingGeneration.fullProfile))
      : null;
    const pd = (doc.profileData as any) || {};
    res.json({
      id: doc.id,
      name: doc.name,
      template: doc.template,
      cv_html: doc.cvHtml,
      cv_json: pd.cv_json ?? null,
       // A recovered legacy generation may have been written into cover_letter
       // before preview gating existed. Never send that matching full text to a
       // free account; the dedicated perfected_letter field above is its safe
       // replacement.
       cover_letter: hasLockedGeneration ? null : doc.coverLetter,
      profile_data: doc.profileData,
      job_title: doc.jobTitle,
      job_company: doc.jobCompany,
      perfected_letter: visiblePerfectedLetter,
      perfected_cv_html: null,
      perfected_profile: visiblePerfectedProfile,
       perfected_generation_id: hasLockedGeneration ? pendingGeneration!.id : null,
       perfected_locked: hasLockedGeneration,
      created_at: doc.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "GET /documents/:id error");
    res.status(500).json({ error: "Server error" });
  }
});

const VALID_TEMPLATES = new Set([
  "modern","classic","creative","executive","minimal","elegant",
  "bold","compact","swiss","nordic","corporate","timeline","slate","terra","custom",
  "blobs","welle","halo","splitblock","klammern","winkel","bogen","zweig","berge",
  "konfetti","wellenband","farbkreis","blobcorner","aurora","prisma","verlaufswelle",
  "blaupause","technik","raster",
]);

/** Reject cv_json payloads that aren't plain objects or contain non-string scalar fields. */
function validateCvJson(cv_json: unknown): string | null {
  if (typeof cv_json !== "object" || Array.isArray(cv_json) || cv_json === null) {
    return "cv_json must be a plain object";
  }
  const obj = cv_json as Record<string, unknown>;
  for (const field of ["name","title","contact","profile","signature"]) {
    if (obj[field] !== undefined && typeof obj[field] !== "string") {
      return `cv_json.${field} must be a string`;
    }
  }
  if (obj.experience !== undefined && !Array.isArray(obj.experience)) {
    return "cv_json.experience must be an array";
  }
  if (obj.education !== undefined && !Array.isArray(obj.education)) {
    return "cv_json.education must be an array";
  }
  if (obj.skills !== undefined && !Array.isArray(obj.skills)) {
    return "cv_json.skills must be an array";
  }
  if (obj.languages !== undefined && !Array.isArray(obj.languages)) {
    return "cv_json.languages must be an array";
  }
  return null; // valid
}

router.patch("/documents/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { cv_html, cv_json, template, cover_letter, perfected_letter, perfected_cv_html } = req.body;

    // Perfected copies: view-only fields shown in the preview; no download
    // endpoint ever reads them. Locked free users may save ONLY these
    // (string to set, null to clear); everything else stays purchase-gated.
    for (const [key, val] of [["perfected_letter", perfected_letter], ["perfected_cv_html", perfected_cv_html]] as const) {
      if (val !== undefined && val !== null && typeof val !== "string") {
        res.status(400).json({ error: `${key} must be a string or null` }); return;
      }
    }
    // Free accounts may edit and save everything (policy 2026-08-19):
    // only downloads and printing stay purchase-gated.

    // Validate template against allowlist
    if (template !== undefined && !VALID_TEMPLATES.has(template)) {
      res.status(400).json({ error: "Invalid template" }); return;
    }

    // Validate cv_json shape
    if (cv_json !== undefined) {
      const err = validateCvJson(cv_json);
      if (err) { res.status(400).json({ error: err }); return; }
    }

    // Validate cv_html is a string (if provided)
    if (cv_html !== undefined && typeof cv_html !== "string") {
      res.status(400).json({ error: "cv_html must be a string" }); return;
    }

    if (cover_letter !== undefined && typeof cover_letter !== "string") {
      res.status(400).json({ error: "cover_letter must be a string" }); return;
    }

    const [existing] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));

    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const updates: Record<string, any> = {};
    if (cv_html !== undefined) updates.cvHtml = cv_html;
    if (template !== undefined) updates.template = template;
    if (cover_letter !== undefined) updates.coverLetter = cover_letter;
    if (cv_json !== undefined) {
      // Merge cv_json into profileData
      const pd = (existing.profileData as any) || {};
      updates.profileData = { ...pd, cv_json };
    }
    if (perfected_letter !== undefined) updates.perfectedLetter = perfected_letter;
    if (perfected_cv_html !== undefined) updates.perfectedCvHtml = perfected_cv_html;

    await db.update(documentsTable).set(updates).where(eq(documentsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /documents/:id error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Free accounts may create unlimited applications (policy 2026-08-19):
    // everything is open except downloads and printing, which stay paid.
    const { name, template, profileData, cvHtml, coverLetter, jobTitle, jobCompany, language } = req.body;
    if (template !== undefined && !VALID_TEMPLATES.has(template)) {
      res.status(400).json({ error: "Invalid template" });
      return;
    }

    const [doc] = await db
      .insert(documentsTable)
      .values({
        userId: req.userId!,
        name,
        template: template || "modern",
        profileData,
        cvHtml,
        coverLetter,
        jobTitle,
        jobCompany,
      })
      .returning();

    res.status(201).json(doc);

    // Fire-and-forget: send confirmation email with download links
    const userEmail = req.userEmail;
    if (userEmail) {
      const appUrl = (process.env.APP_URL || "https://bewerbungski.com").replace(/\/$/, "");
      const { subject, html } = buildDocumentEmail({
        documentId: doc.id,
        documentName: name || "Bewerbungsunterlagen",
        jobTitle: jobTitle || undefined,
        jobCompany: jobCompany || undefined,
        hasCoverLetter: Boolean(coverLetter),
        appUrl,
        language: language || "de",
      });
      sendEmail({ to: userEmail, subject, html }).catch((err) => {
        req.log.error({ err }, "Failed to send document confirmation email");
      });
    }
  } catch (err) {
    req.log.error({ err }, "POST /documents error");
    res.status(500).json({ error: "Server error" });
  }
});

// Nachträgliche Anschreiben-Erzeugung für bestehende Dokumente ohne Anschreiben.
// Kein Kredit-Check: das Dokument existiert bereits und zählt schon gegen das Limit.
const LETTER_LANGS: Record<string, { name: string; locale: string; conventions: string }> = {
  de: { name: "Deutsch", locale: "de-DE", conventions: "Deutsche Bewerbungsstandards (DIN 5008)." },
  en: { name: "Englisch", locale: "en-GB", conventions: "Britisch/internationale Standards: 'Cover Letter'." },
  tr: { name: "Türkisch", locale: "tr-TR", conventions: "Türkische Bewerbungsstandards." },
  ar: { name: "Arabisch", locale: "ar", conventions: "Korrektes Hocharabisch, Layout rechtsläufig gedacht." },
  es: { name: "Spanisch", locale: "es-ES", conventions: "Spanische Standards (Carta de presentación)." },
  pl: { name: "Polnisch", locale: "pl-PL", conventions: "Polnische Bewerbungsstandards." },
  ru: { name: "Russisch", locale: "ru-RU", conventions: "Russische Standards." },
  uk: { name: "Ukrainisch", locale: "uk-UA", conventions: "Ukrainische Standards." },
};

// Missbrauchsschutz: pro Dokument nur eine laufende Erzeugung, pro Nutzer max.
// LETTER_REGEN_MAX Aufrufe pro Zeitfenster (Endpoint ist bewusst ohne Kredit-Check,
// da das Dokument bereits gegen das Limit zählt).
const letterRegenInFlight = new Set<string>();
const letterRegenHistory = new Map<string, number[]>();
const LETTER_REGEN_MAX = 5;
const LETTER_REGEN_WINDOW_MS = 10 * 60 * 1000;

router.post("/documents/:id/cover-letter", requireAuth, requireVerifiedEmail, async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.id);
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, docId), eq(documentsTable.userId, req.userId!)));
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }

    // Idempotent: existiert bereits ein Anschreiben, wird es zurückgegeben —
    // keine erneute (kostenpflichtige) KI-Generierung.
    if (doc.coverLetter && doc.coverLetter.trim() !== "") {
      res.json({ result: doc.coverLetter, alreadyExisted: true });
      return;
    }

    // Rate-Limit pro Nutzer
    const now = Date.now();
    const hist = (letterRegenHistory.get(req.userId!) || []).filter((t) => now - t < LETTER_REGEN_WINDOW_MS);
    if (hist.length >= LETTER_REGEN_MAX) {
      letterRegenHistory.set(req.userId!, hist);
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    // Parallel-Schutz pro Dokument
    if (letterRegenInFlight.has(docId)) {
      res.status(409).json({ error: "generation_in_progress" });
      return;
    }
    letterRegenInFlight.add(docId);
    hist.push(now);
    letterRegenHistory.set(req.userId!, hist);

    try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI generation not configured. Please set ANTHROPIC_API_KEY." });
      return;
    }

    const pd = (doc.profileData as any) || {};
    const personal = pd.personal || {};
    const jobad = pd.jobad || {};
    const experience: any[] = Array.isArray(pd.experience) ? pd.experience : [];
    const skills: any[] = Array.isArray(pd.skills) ? pd.skills : [];
    const lang = LETTER_LANGS[pd.language] || LETTER_LANGS.de;
    const langInstr = lang === LETTER_LANGS.de || pd.language === "de" ? "" :
      ` WICHTIG: Schreibe den GESAMTEN Inhalt auf ${lang.name} (nicht auf Deutsch). Beachte die landestypischen Konventionen: ${lang.conventions}`;
    const today = new Date().toLocaleDateString(lang.locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    const hasJobad = !!(jobad.title || jobad.description || jobad.company);

    const systemPrompt = `Du bist Experte für Bewerbungsanschreiben. Schreibe wie ein echter, gut ausgebildeter Mensch — nicht wie eine KI.

TON: FORMELL - klassisches Geschaeftsdeutsch, 'Sehr geehrte Damen und Herren', serioese Sprache, keine persoenlichen Anekdoten. Praezise, sachlich, professionell.

REGELN:
- Keine KI-Phrasen: kein „dynamisch", „leidenschaftlich", „stets", „zeitnah", „ich bin überzeugt, dass ich", „ich freue mich sehr".
- Keine Aufzählungen mit Gedankenstrichen im Fließtext.
- Aktive Sprache: „Ich entwickelte" statt „Es wurde entwickelt".
- Eröffnung NICHT mit „Hiermit bewerbe ich mich".

STRUKTUR (DIN 5008):
1. Empfängeradresse des Unternehmens (linke Seite)
2. Datum-Zeile
3. Betreffzeile (ohne „Betreff:")
4. Anrede
5. Einleitung: konkreter Bezug zur Stelle / zum Unternehmen
6. Hauptteil: Erfahrung + Mehrwert
7. Motivationsabsatz
8. Schluss: Gesprächseinladung, keine Floskeln
9. „Mit freundlichen Grüßen" + Name

Ausgabe: NUR der Anschreiben-Text, kein HTML, keine Erklärungen. 350–420 Wörter.`;

    const userPrompt = `Schreibe Anschreiben (Sprache: ${lang.name}):

Bewerber: ${personal.firstName || ""} ${personal.lastName || ""}${personal.title ? ", " + personal.title : ""}
Adresse Bewerber: ${[personal.address, `${personal.zip || ""} ${personal.city || ""}`.trim()].filter(Boolean).join(", ")}
Stelle: ${hasJobad ? `${jobad.title || "Initiativbewerbung"} bei ${jobad.company || "dem Unternehmen"}` : `Initiativbewerbung als ${experience[0]?.position || personal.title || "Fachkraft"} (keine konkrete Stellenanzeige — schreibe ein überzeugendes Initiativ-Anschreiben passend zum Werdegang, Empfängeradresse generisch als "Personalabteilung" ohne erfundenen Firmennamen)`}${jobad.address ? `\nUnternehmensadresse (MUSS als Empfängeradresse erscheinen): ${jobad.address}` : ""}
Stellenbeschreibung: ${jobad.description || "nicht angegeben"}

Erfahrung (aktuellste zuerst):
${experience.slice(0, 4).map((e) => `• ${e.position} bei ${e.company}${e.city ? ", " + e.city : ""}${e.start ? " (" + String(e.start).slice(0, 7) + " – " + (e.current ? "heute" : String(e.end || "").slice(0, 7)) + ")" : ""}${e.description ? ": " + String(e.description).slice(0, 120) : ""}`).join("\n")}

Kernkompetenzen: ${skills.slice(0, 10).map((s) => s.name).join(", ") || "aus Erfahrung ableiten"}

Datum-Zeile EXAKT: "${personal.city || "Ort"}, den ${today}"
Eröffnung NICHT mit „Hiermit bewerbe ich mich".${langInstr}`;

    const callClaude = () =>
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
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

    let response = await callClaude();
    if (response.status === 429 || response.status === 529) {
      const retryAfter = parseFloat(response.headers.get("retry-after") || "");
      const waitSec = Math.min(Number.isFinite(retryAfter) ? retryAfter + 1 : 15, 40);
      req.log.warn({ waitSec }, "Claude rate limit/overloaded, retrying once");
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      response = await callClaude();
    }

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Claude API error (cover-letter regen)");
      if (response.status === 429 || response.status === 529) {
        res.status(503).json({ error: "busy_try_again" });
        return;
      }
      res.status(500).json({ error: "Generation failed" });
      return;
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    let result = data.content?.find((b) => b.type === "text")?.text ?? "";
    result = result.replace(/^```(?:html|xml)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    if (!result) {
      res.status(500).json({ error: "Generation failed" });
      return;
    }

    // Konditionales Update: nur schreiben, wenn weiterhin kein Anschreiben existiert
    // (verhindert Überschreiben bei parallelen Anfragen über mehrere Prozesse).
    const updated = await db
      .update(documentsTable)
      .set({ coverLetter: result })
      .where(and(
        eq(documentsTable.id, doc.id),
        sql`(${documentsTable.coverLetter} IS NULL OR ${documentsTable.coverLetter} = '')`,
      ))
      .returning({ id: documentsTable.id });

    if (!updated || updated.length === 0) {
      // Ein anderer Prozess hat inzwischen ein Anschreiben gespeichert — dieses zurückgeben.
      const [fresh] = await db
        .select()
        .from(documentsTable)
        .where(and(eq(documentsTable.id, doc.id), eq(documentsTable.userId, req.userId!)));
      res.json({ result: fresh?.coverLetter || result, alreadyExisted: true });
      return;
    }

    res.json({ result });
    } finally {
      letterRegenInFlight.delete(docId);
    }
  } catch (err) {
    req.log.error({ err }, "POST /documents/:id/cover-letter error");
    res.status(500).json({ error: "Generation failed" });
  }
});

router.delete("/documents/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await db
      .delete(documentsTable)
      .where(
        and(
          eq(documentsTable.id, req.params.id),
          eq(documentsTable.userId, req.userId!)
        )
      );

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "DELETE /documents/:id error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
