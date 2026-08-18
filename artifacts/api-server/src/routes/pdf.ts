import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isFreeQuotaLocked, isFreeAccount, consumeExportQuota } from "../lib/freeLock";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import { templateDeco } from "@workspace/template-deco";

const router = Router();

// ── Chromium path (resolved once at module load, never per-request) ───────────
/**
 * Discovery order:
 * 1. CHROMIUM_PATH env var  – fastest; set explicitly in Replit or Railway vars
 * 2. `which chromium`       – works when chromium is installed via nixpkgs (Railway)
 * 3. Known system paths     – fallback for Docker / Debian images
 */
function resolveChromiumPath(): string {
  // 1. Explicit env var — zero shell invocation
  const envPath = process.env.CHROMIUM_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  // 2. PATH lookup — chromium in nixpkgs puts the binary in PATH (Railway)
  try {
    const p = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null", {
      encoding: "utf-8",
      timeout: 3_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (p && existsSync(p)) return p;
  } catch { /* not in PATH, continue */ }

  // 3. Known fixed paths — no shell needed
  for (const p of [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ]) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    "Chromium not found. Install chromium (via nixpkgs or apt) or set the CHROMIUM_PATH environment variable."
  );
}

// Resolved once at cold-start — avoids any per-request shell execution
let CHROMIUM_EXEC: string = "";
let CHROMIUM_ERROR: string = "";
try {
  CHROMIUM_EXEC = resolveChromiumPath();
} catch (err: any) {
  CHROMIUM_ERROR = err.message;
}

// ── Puppeteer helper ──────────────────────────────────────────────────────────
/**
 * Renders `html` to an A4 PDF and returns the buffer.
 *
 * Security: all outgoing network requests are intercepted and aborted so
 * user-supplied content cannot probe internal services (SSRF).
 * Only data: URIs (inline images, embedded fonts) are allowed through.
 */
async function htmlToPdf(html: string): Promise<Buffer> {
  if (!CHROMIUM_EXEC) {
    const err = new Error(CHROMIUM_ERROR || "Chromium not available");
    (err as any).statusCode = 503;
    throw err;
  }

  const puppeteer = await import("puppeteer-core");

  const browser = await puppeteer.default.launch({
    executablePath: CHROMIUM_EXEC,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // SSRF protection: abort every outgoing request except inline data: URIs.
    // Exception: local letterhead PNGs (/letterheads/NN-name.png) are served
    // directly from the built frontend assets on disk — no network involved.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:")) { req.continue(); return; }
      const m = url.match(/\/letterheads\/([a-z0-9-]+\.png)$/i);
      if (m) {
        try {
          const dir = path.resolve(__dirname, "../../bewerbungski/dist/public/letterheads");
          const file = path.resolve(dir, m[1]);
          if (file.startsWith(dir + path.sep) && existsSync(file)) {
            req.respond({ status: 200, contentType: "image/png", body: readFileSync(file) });
            return;
          }
        } catch { /* fall through to abort */ }
      }
      req.abort("blockedbyclient");
    });

    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── HTML sanitisation helpers ─────────────────────────────────────────────────
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Remove @import url('https://…') from style blocks.
 * These would be aborted by request interception — remove them so there's no
 * console noise and layout is unchanged (templates declare fallback fonts).
 */
function stripNetworkImports(html: string): string {
  return html.replace(
    /@import\s+url\(['"]?https?:\/\/[^)'"]+['"]?\)\s*;?/g,
    "/* network import removed */"
  );
}

/** Ensure `fragment` is a full HTML document. */
function wrapHtml(fragment: string): string {
  const cleaned = stripNetworkImports(fragment);
  if (cleaned.trimStart().startsWith("<!DOCTYPE") || cleaned.includes("<html")) {
    return cleaned;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;}body{margin:0;padding:0;}a{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;padding:0;background:#fff;">${cleaned}</body></html>`;
}

// ── Error helper ──────────────────────────────────────────────────────────────
function sendPdfError(res: any, err: any, label: string, log: any) {
  log.error({ err }, label);
  const status = err?.statusCode === 503 ? 503 : 500;
  const message =
    status === 503
      ? "PDF generation is not available (Chromium not installed). Contact support."
      : "PDF generation failed.";
  res.status(status).json({ error: message });
}

// ── CV PDF ────────────────────────────────────────────────────────────────────
router.get("/documents/:id/download/cv.pdf", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    if (!doc.cvHtml) { res.status(404).json({ error: "No CV HTML stored" }); return; }

    // Free trial: one CV PDF download per document
    if (await isFreeAccount(req.userId!, req.userEmail)) {
      if (!(await consumeExportQuota(req.userId!, doc.id, "cv_pdf"))) {
        res.status(403).json({ error: "download_limit_reached" });
        return;
      }
    }

    const pdfBuffer = await htmlToPdf(wrapHtml(doc.cvHtml));

    const safeName = (doc.name || "Lebenslauf").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    const filename = `${safeName} – Lebenslauf.pdf`;
    const asciiName = `${safeName} - Lebenslauf.pdf`.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(pdfBuffer);
  } catch (err: any) {
    sendPdfError(res, err, "CV PDF error", req.log);
  }
});

// ── Cover Letter PDF ──────────────────────────────────────────────────────────
router.get("/documents/:id/download/cover-letter.pdf", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }

    // Accept edited text from query param (same pattern as cover-letter.docx).
    // Locked free users may only export the stored original — never edited/
    // perfected text passed from the client.
    const allowOverride = !(await isFreeQuotaLocked(req.userId!, req.userEmail));
    const letterText: string = (allowOverride && (req.query.text as string)) || doc.coverLetter || "";
    if (!letterText.trim()) { res.status(404).json({ error: "No cover letter" }); return; }

    // Free trial: one cover-letter PDF download per document
    if (await isFreeAccount(req.userId!, req.userEmail)) {
      if (!(await consumeExportQuota(req.userId!, doc.id, "letter_pdf"))) {
        res.status(403).json({ error: "download_limit_reached" });
        return;
      }
    }

    const pd = (doc.profileData as any) || {};
    const p = pd.personal || {};
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim();

    const paragraphs = letterText
      .split(/\n/)
      .map((line: string) =>
        line.trim() === ""
          ? `<p class="gap"></p>`
          : `<p>${escHtml(line)}</p>`
      )
      .join("");

    // Deko-Layer passend zur gewählten CV-Vorlage (dezent, hinter dem Text)
    const deco = templateDeco(doc.template, (doc.profileData as any)?.customStyle?.accent);

    // All styles are inline — no external requests needed
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    background: #fff;
    color: #1f2937;
    font-size: 12px;
    line-height: 1.8;
  }
  .sheet {
    position: relative;
    z-index: 0;
    overflow: hidden;
    min-height: 297mm;
    padding: 56px 68px;
    background: #fff;
  }
  .name {
    font-size: 17px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    text-align: center;
    margin-bottom: 8px;
  }
  .divider {
    border: none;
    border-top: 1px solid #1f2937;
    margin-bottom: 32px;
  }
  p { margin-bottom: 0; text-align: justify; }
  p.gap { margin-bottom: 8px; }
  a { color: inherit !important; text-decoration: none !important; }
</style>
</head>
<body>
<div class="sheet">
${deco}
${fullName ? `<div class="name">${escHtml(fullName)}</div><hr class="divider">` : ""}
${paragraphs}
</div>
</body>
</html>`;

    const pdfBuffer = await htmlToPdf(html);

    const safeName = (doc.name || "Anschreiben").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    const filename = `${safeName} – Anschreiben.pdf`;
    const asciiName = `${safeName} - Anschreiben.pdf`.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(pdfBuffer);
  } catch (err: any) {
    sendPdfError(res, err, "Cover letter PDF error", req.log);
  }
});

export default router;
