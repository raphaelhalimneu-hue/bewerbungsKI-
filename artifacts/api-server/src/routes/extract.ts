import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// Extract plain text from an uploaded file (PDF, DOCX, TXT, or photo via Claude OCR).
// Body: { filename, mimeType, data } with data = base64 (no data: prefix).
// Free feature — guarded by a daily per-user quota and size limits.

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB decoded (PDF/DOCX parsed locally; photos are compressed client-side before upload)
const DAILY_EXTRACT_LIMIT = 20;
const usage = new Map<string, { day: string; count: number }>();
function checkQuota(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  let u = usage.get(userId);
  if (!u || u.day !== day) { u = { day, count: 0 }; usage.set(userId, u); }
  if (u.count >= DAILY_EXTRACT_LIMIT) return false;
  u.count++;
  if (usage.size > 10000) usage.clear();
  return true;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function ocrWithClaude(mimeType: string, base64: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const call = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: "Du bist ein präzises OCR-Werkzeug. Gib den kompletten Text des Bildes wieder – originalgetreu, in Leserichtung, ohne Kommentare, ohne Übersetzung, ohne Markdown.",
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: "Extrahiere den gesamten Text aus diesem Dokument." },
        ] }],
      }),
    });
  let response = await call();
  if (response.status === 429 || response.status === 529) {
    await new Promise(r => setTimeout(r, 3000));
    response = await call();
  }
  if (!response.ok) return null;
  const data: any = await response.json();
  return data?.content?.[0]?.text ?? null;
}

router.post("/extract", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { mimeType, data } = req.body || {};
    if (typeof mimeType !== "string" || typeof data !== "string" || data.length === 0) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    if (data.length > MAX_FILE_BYTES * 1.4) {
      res.status(413).json({ error: "file_too_large" });
      return;
    }
    if (!checkQuota(req.userId!)) {
      res.status(429).json({ error: "daily_limit_reached" });
      return;
    }
    const buf = Buffer.from(data, "base64");
    if (buf.length === 0 || buf.length > MAX_FILE_BYTES) {
      res.status(413).json({ error: "file_too_large" });
      return;
    }

    let text: string | null = null;
    if (mimeType === "application/pdf") {
      if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
        res.status(415).json({ error: "unsupported_type" });
        return;
      }
      // Import the lib file directly: pdf-parse's index.js runs debug code when bundled
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default as any;
      const out = await pdfParse(buf, { max: 30 }); // cap pages against pathological PDFs
      text = out?.text ?? null;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      if (buf[0] !== 0x50 || buf[1] !== 0x4b) { // "PK" zip signature
        res.status(415).json({ error: "unsupported_type" });
        return;
      }
      const mammoth = await import("mammoth");
      const out = await mammoth.extractRawText({ buffer: buf });
      text = out?.value ?? null;
    } else if (IMAGE_TYPES.has(mimeType)) {
      text = await ocrWithClaude(mimeType === "image/gif" ? "image/gif" : mimeType, data);
    } else if (mimeType === "text/plain") {
      text = buf.toString("utf8");
    } else {
      res.status(415).json({ error: "unsupported_type" });
      return;
    }

    text = (text || "").replace(/\u0000/g, "").trim();
    if (!text || text.length < 20) {
      res.status(422).json({ error: "no_text_found" });
      return;
    }
    res.json({ text: text.slice(0, 60000) });
  } catch (err) {
    req.log?.error({ err }, "extract failed");
    res.status(500).json({ error: "extract_failed" });
  }
});

// ── Design analysis: extract a color/font style from an uploaded CV (image or PDF) ──
router.post("/design", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { mimeType, data } = req.body || {};
    if (typeof mimeType !== "string" || typeof data !== "string" || data.length === 0) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    if (data.length > MAX_FILE_BYTES * 1.4) {
      res.status(413).json({ error: "file_too_large" });
      return;
    }
    const isImage = IMAGE_TYPES.has(mimeType) && mimeType !== "image/gif";
    const isPdf = mimeType === "application/pdf";
    if (!isImage && !isPdf) {
      res.status(415).json({ error: "unsupported_type" });
      return;
    }
    if (!checkQuota(req.userId!)) {
      res.status(429).json({ error: "daily_limit_reached" });
      return;
    }
    const buf = Buffer.from(data, "base64");
    if (buf.length === 0 || buf.length > MAX_FILE_BYTES) {
      res.status(413).json({ error: "file_too_large" });
      return;
    }
    if (isPdf && buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      res.status(415).json({ error: "unsupported_type" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(503).json({ error: "ai_unavailable" }); return; }
    const contentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data } };
    const call = () =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          system: `Du analysierst das visuelle Design eines Lebenslaufs. Antworte NUR mit validem JSON, exakt dieses Schema:
{"font":"serif"|"sans","accent":"#hex","headerBg":"#hex oder transparent","headerText":"#hex","subColor":"#hex","chipBg":"#hex","chipText":"#hex"}
- accent: die dominante Akzentfarbe (Überschriften/Linien)
- headerBg: Hintergrundfarbe des Kopfbereichs, "transparent" wenn weiß/keiner
- headerText: Textfarbe im Kopfbereich
- subColor: Farbe für Nebentexte (Firma, Ort)
- chipBg/chipText: dezente Hintergrund-/Textfarbe für Skill-Tags, passend zur Akzentfarbe
- font: "serif" wenn die Überschriften Serifen haben, sonst "sans"
Alle Farben als 6-stellige Hex-Werte.`,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Analysiere das Design dieses Lebenslaufs." }] }],
        }),
      });
    let response = await call();
    if (response.status === 429 || response.status === 529) {
      await new Promise(r => setTimeout(r, 3000));
      response = await call();
    }
    if (!response.ok) { res.status(502).json({ error: "ai_failed" }); return; }
    const out: any = await response.json();
    const raw = String(out?.content?.[0]?.text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let style: any;
    try { style = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { style = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!style || typeof style !== "object") { res.status(502).json({ error: "ai_failed" }); return; }
    // Server-side sanitation: only hex colors / allowed values leave this endpoint.
    const hex = (v: unknown, fb: string) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fb);
    res.json({
      font: style.font === "serif" ? "serif" : "sans",
      accent: hex(style.accent, "#1f2937"),
      headerBg: style.headerBg === "transparent" ? "transparent" : hex(style.headerBg, "transparent"),
      headerText: hex(style.headerText, "#111827"),
      subColor: hex(style.subColor, "#6b7280"),
      chipBg: hex(style.chipBg, "#f3f4f6"),
      chipText: hex(style.chipText, "#374151"),
    });
  } catch (err) {
    req.log?.error({ err }, "design analysis failed");
    res.status(500).json({ error: "design_failed" });
  }
});

export default router;
