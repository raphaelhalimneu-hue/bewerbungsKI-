import { Router } from "express";
import {
  Document, Paragraph, TextRun, Packer,
  AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType, TableLayoutType,
} from "docx";
import { db, documentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { isFreeQuotaLocked, isFreeAccount } from "../lib/freeLock";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
const FONT = "Calibri";
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "auto" };
const NO_BORDERS_TABLE = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideH: NO_BORDER, insideV: NO_BORDER };
const NO_BORDERS_CELL = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

// Normalize exotic Unicode spaces (NBSP, narrow NBSP, thin space, zero-width...)
// that AI-generated text sometimes contains — some Word/Docs viewers render
// them as zero width, which makes words appear glued together.
function cleanText(text: string): string {
  return String(text ?? "")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}
function bold(text: string, size = 22) {
  return new TextRun({ text: cleanText(text), bold: true, size, font: FONT });
}
function normal(text: string, size = 22) {
  return new TextRun({ text: cleanText(text), size, font: FONT });
}
function muted(text: string, size = 20) {
  return new TextRun({ text: cleanText(text), size, color: "6B7280", font: FONT });
}
// ── Template themes ──────────────────────────────────────────────────────────
// Accent colors mirror the HTML templates in bewerbungski/src/lib/buildCVHTML.ts
// so the Word download picks up the same Vorlagen-Optik (colored top bar,
// section-heading color, rule colors). Word can't reproduce the decorative
// gradients/circles, but the color identity of each template carries over.
type DocxTheme = { accent: string; rule: string };
const TEMPLATE_THEMES: Record<string, DocxTheme> = {
  modern:    { accent: "111827", rule: "E5E7EB" }, // header border #111827, section rules #e5e7eb
  classic:   { accent: "0F172A", rule: "0F172A" }, // 3px header + 2px section rules in #0f172a
  creative:  { accent: "1E3A5F", rule: "E5E7EB" }, // sidebar navy #1e3a5f, section rules #e5e7eb
  executive: { accent: "1F2937", rule: "CBD5E1" }, // navy #1f2937, rules #cbd5e1
  minimal:   { accent: "111827", rule: "F3F4F6" }, // near-black text, hairline rules #f3f4f6
  elegant:   { accent: "92400E", rule: "92400E" }, // gold #92400e headings + rules
  bold:      { accent: "0F172A", rule: "0F172A" }, // dark header block + 2px rules #0f172a
  compact:   { accent: "1F2937", rule: "E5E7EB" }, // headings #1f2937, rules #e5e7eb
  swiss:     { accent: "DC2626", rule: "E5E7EB" }, // red bar/headings #dc2626, dividers #e5e7eb
  nordic:    { accent: "0D9488", rule: "0D9488" }, // teal #0d9488 headings + 2px rules
  corporate: { accent: "065F46", rule: "065F46" }, // green #065f46 headings + 2px rules
  timeline:  { accent: "EA580C", rule: "EA580C" }, // orange #ea580c headings, 3px header border
  slate:     { accent: "334155", rule: "334155" }, // slate #334155 headings + 2px rules
  terra:     { accent: "C2410C", rule: "FED7AA" }, // terracotta #c2410c headings, rules #fed7aa
  // Briefkopf-Designs (PNG-Hintergründe im Web; Word übernimmt die Akzentfarbe)
  blobs:         { accent: "D97B7B", rule: "FBEAEA" },
  welle:         { accent: "4A7CB5", rule: "E7F0FA" },
  halo:          { accent: "C97A5A", rule: "F7E8DE" },
  splitblock:    { accent: "1A1A1A", rule: "F0F0F0" },
  klammern:      { accent: "1F4D47", rule: "E9EFE9" },
  winkel:        { accent: "5C1A2B", rule: "F4E8EC" },
  bogen:         { accent: "B8873F", rule: "F6EEDD" },
  zweig:         { accent: "1F3A5F", rule: "E8EDF5" },
  berge:         { accent: "A8552F", rule: "F5E9E2" },
  konfetti:      { accent: "D94F4F", rule: "FDECEC" },
  wellenband:    { accent: "D16587", rule: "FDEEF3" },
  farbkreis:     { accent: "E76F51", rule: "FDEEE8" },
  blobcorner:    { accent: "7C6FF2", rule: "EFECFD" },
  aurora:        { accent: "E05575", rule: "FDEEF1" },
  prisma:        { accent: "2FB5A3", rule: "E6F7F3" },
  verlaufswelle: { accent: "7C6FF2", rule: "EFECFD" },
  blaupause:     { accent: "2B5A8C", rule: "E9F0F7" },
  technik:       { accent: "3D3D3D", rule: "EFEFEF" },
  raster:        { accent: "2F5940", rule: "E9F1EC" },
};
const DEFAULT_THEME: DocxTheme = { accent: "1F2937", rule: "D1D5DB" };
function themeFor(template: unknown, profileData?: any): DocxTheme {
  if (String(template) === "custom") {
    const acc = profileData?.customStyle?.accent;
    if (typeof acc === "string" && /^#[0-9a-fA-F]{6}$/.test(acc)) {
      return { accent: acc.slice(1).toUpperCase(), rule: "E5E7EB" };
    }
    return DEFAULT_THEME;
  }
  return TEMPLATE_THEMES[String(template || "")] || DEFAULT_THEME;
}
/** Thick colored bar at the very top of the page, matching the template accent. */
function topBar(theme: DocxTheme) {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 28, color: theme.accent } },
    spacing: { before: 0, after: 200 },
    children: [],
  });
}
function hr(theme: DocxTheme = DEFAULT_THEME) {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: theme.accent } },
    spacing: { before: 160, after: 160 },
    children: [],
  });
}
function sectionHeading(title: string, theme: DocxTheme = DEFAULT_THEME) {
  return new Paragraph({
    children: [new TextRun({ text: cleanText(title.toUpperCase()), bold: true, size: 19, font: FONT, color: theme.accent })],
    spacing: { before: 280, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.rule } },
  });
}

type DocxHeadings = { profile: string; education: string; experience: string; skills: string; languages: string; present: string };
const HEADINGS_BY_LANG: Record<string, DocxHeadings> = {
  de: { profile: "Profil", education: "Ausbildung", experience: "Berufserfahrung", skills: "Kenntnisse", languages: "Sprachen", present: "heute" },
  en: { profile: "Profile", education: "Education", experience: "Work Experience", skills: "Skills", languages: "Languages", present: "present" },
  tr: { profile: "Profil", education: "E\u011fitim", experience: "\u0130\u015f Deneyimi", skills: "Beceriler", languages: "Diller", present: "halen" },
  ar: { profile: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a", education: "\u0627\u0644\u062a\u0639\u0644\u064a\u0645", experience: "\u0627\u0644\u062e\u0628\u0631\u0629 \u0627\u0644\u0645\u0647\u0646\u064a\u0629", skills: "\u0627\u0644\u0645\u0647\u0627\u0631\u0627\u062a", languages: "\u0627\u0644\u0644\u063a\u0627\u062a", present: "\u062d\u062a\u0649 \u0627\u0644\u0622\u0646" },
  es: { profile: "Perfil", education: "Formaci\u00f3n", experience: "Experiencia laboral", skills: "Competencias", languages: "Idiomas", present: "actualidad" },
  pl: { profile: "Profil", education: "Wykszta\u0142cenie", experience: "Do\u015bwiadczenie zawodowe", skills: "Umiej\u0119tno\u015bci", languages: "J\u0119zyki", present: "obecnie" },
  ru: { profile: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c", education: "\u041e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435", experience: "\u041e\u043f\u044b\u0442 \u0440\u0430\u0431\u043e\u0442\u044b", skills: "\u041d\u0430\u0432\u044b\u043a\u0438", languages: "\u042f\u0437\u044b\u043a\u0438", present: "\u043f\u043e \u043d\u0430\u0441\u0442. \u0432\u0440\u0435\u043c\u044f" },
  uk: { profile: "\u041f\u0440\u043e\u0444\u0456\u043b\u044c", education: "\u041e\u0441\u0432\u0456\u0442\u0430", experience: "\u0414\u043e\u0441\u0432\u0456\u0434 \u0440\u043e\u0431\u043e\u0442\u0438", skills: "\u041d\u0430\u0432\u0438\u0447\u043a\u0438", languages: "\u041c\u043e\u0432\u0438", present: "\u0434\u043e\u0442\u0435\u043f\u0435\u0440" },
};
function headingsFor(profileData: any): DocxHeadings {
  const lang = String(profileData?.language || "de");
  return HEADINGS_BY_LANG[lang] || HEADINGS_BY_LANG.de;
}
function formatPeriod(start?: string, end?: string, current?: boolean, presentWord = "heute"): string {
  const fmt = (d: string) => {
    if (!d) return "";
    // "2021-03" → "03/2021", "2021" → "2021"
    const parts = d.split("-");
    return parts.length >= 2 ? `${parts[1]}/${parts[0]}` : parts[0];
  };
  const s = fmt(start || "");
  const e = current ? presentWord : fmt(end || "");
  return [s, e].filter(Boolean).join(" – ");
}

/**
 * Inline edits in the compact preview change the already-rendered CV HTML,
 * rather than the structured editor JSON. Convert that trusted, saved HTML
 * into readable Word paragraphs so the downloaded document contains exactly
 * the edited text instead of the original profile data.
 */
function htmlToDocumentLines(html: string): string[] {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  const decodeEntities = (value: string) => value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code) => {
      const number = String(code).toLowerCase().startsWith("x")
        ? parseInt(String(code).slice(1), 16)
        : parseInt(String(code), 10);
      try {
        return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
      } catch {
        return entity;
      }
    })
    .replace(/&([a-z]+);/gi, (entity, name) => namedEntities[String(name).toLowerCase()] ?? entity);

  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(address|article|div|footer|h[1-6]|header|li|p|section|tr|ul|ol)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function createEditedHtmlCvDocx(html: string, theme: DocxTheme): Document {
  const lines = htmlToDocumentLines(html);
  const firstContentIndex = lines.findIndex(Boolean);
  const children: Paragraph[] = [topBar(theme)];

  for (const [index, line] of lines.entries()) {
    children.push(new Paragraph({
      children: [
        index === firstContentIndex
          ? new TextRun({ text: cleanText(line), bold: true, size: 32, font: FONT, color: theme.accent })
          : normal(line, 21),
      ],
      spacing: { after: 90 },
    }));
  }

  return new Document({
    sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }],
  });
}

// ── CV DOCX ──────────────────────────────────────────────────────────────────
router.get("/documents/:id/download/cv.docx", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const documentId = String(req.params.id);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    const storedProfileData = (doc.profileData as any) || {};
    if (storedProfileData.documentTypes?.cv === false || (!doc.cvHtml && !storedProfileData.cv_json)) {
      res.status(404).json({ error: "No CV stored" });
      return;
    }
    if (!doc.bezahlt) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }

    const pd = storedProfileData;
    const p = pd.personal || {};
    const experience: any[] = pd.experience || [];
    const education: any[] = pd.education || [];
    const skills: any[] = pd.skills || [];
    const languages: any[] = pd.languages || [];
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim();
    const theme = themeFor(doc.template, (doc.profileData as any));
    const H = headingsFor(doc.profileData as any);

    if (storedProfileData.previewCvHtmlEdited && doc.cvHtml) {
      const wordDoc = createEditedHtmlCvDocx(doc.cvHtml, theme);
      const buffer = await Packer.toBuffer(wordDoc);
      const safeName = (doc.name || "Lebenslauf").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const asciiName = `${safeName} - Lebenslauf.docx`.replace(/[^\x20-\x7E]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName + " – Lebenslauf.docx")}`);
      res.send(buffer);
      return;
    }

    // Contact line: address | phone | email | linkedin
    const contactParts = [
      [p.address, p.zip, p.city].filter(Boolean).join(" "),
      p.phone,
      p.email,
      p.linkedin,
    ].filter(Boolean);

    const children: any[] = [];
    children.push(topBar(theme));

    // ── Header ──
    if (fullName) {
      children.push(new Paragraph({
        children: [new TextRun({ text: cleanText(fullName.toUpperCase()), bold: true, size: 40, font: FONT, characterSpacing: 40, color: theme.accent })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }));
    }
    if (p.title) {
      children.push(new Paragraph({
        children: [muted(p.title, 22)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }));
    }
    if (contactParts.length) {
      children.push(new Paragraph({
        children: [muted(contactParts.join("  ·  "), 18)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }));
    }
    children.push(hr(theme));

    // ── Profil ──
    if (p.summary) {
      children.push(sectionHeading(H.profile, theme));
      children.push(new Paragraph({
        children: [normal(p.summary, 21)],
        spacing: { after: 80 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }

    // ── Berufserfahrung ──
    if (experience.length) {
      children.push(sectionHeading(H.experience, theme));
      for (const exp of experience) {
        const period = formatPeriod(exp.start, exp.end, exp.current, H.present);
        const companyLine = [exp.company, exp.city].filter(Boolean).join(", ");
        const descLines: string[] = exp.description
          ? exp.description.split(/\n/).map((l: string) => l.trim()).filter(Boolean)
          : [];
        const detailParagraphs = [
          ...(exp.position ? [new Paragraph({ children: [bold(exp.position, 22)], spacing: { before: 140, after: 30 } })] : []),
          ...(companyLine ? [new Paragraph({ children: [muted(companyLine, 20)], spacing: { after: 50 } })] : []),
          ...descLines.map((line: string) =>
            new Paragraph({
              children: [normal("• " + line.replace(/^[-•·]\s*/, ""), 20)],
              spacing: { after: 30 },
              indent: { left: 120 },
            })
          ),
        ];

        children.push(new Table({
          width: { size: 10106, type: WidthType.DXA },
          columnWidths: [7883, 2223],
          layout: TableLayoutType.FIXED,
          borders: NO_BORDERS_TABLE,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 7883, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: detailParagraphs.length ? detailParagraphs : [new Paragraph({})],
            }),
            new TableCell({
              width: { size: 2223, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: [
                new Paragraph({ children: [muted(period, 18)], alignment: AlignmentType.RIGHT, spacing: { before: 140 } }),
              ],
            }),
          ] })],
        }));
      }
    }

    // ── Ausbildung ──
    if (education.length) {
      children.push(sectionHeading(H.education, theme));
      for (const edu of education) {
        const period = formatPeriod(edu.start, edu.end);
        // institution field (not school)
        const institutionLine = [edu.institution, edu.city].filter(Boolean).join(", ");
        const degreeLine = [edu.degree, edu.field].filter(Boolean).join(" – ");
        const detailParagraphs = [
          ...(degreeLine ? [new Paragraph({ children: [bold(degreeLine, 22)], spacing: { before: 140, after: 30 } })] : []),
          ...(institutionLine ? [new Paragraph({ children: [muted(institutionLine, 20)], spacing: { after: 80 } })] : []),
        ];

        children.push(new Table({
          width: { size: 10106, type: WidthType.DXA },
          columnWidths: [7883, 2223],
          layout: TableLayoutType.FIXED,
          borders: NO_BORDERS_TABLE,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 7883, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: detailParagraphs.length ? detailParagraphs : [new Paragraph({})],
            }),
            new TableCell({
              width: { size: 2223, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: [
                new Paragraph({ children: [muted(period, 18)], alignment: AlignmentType.RIGHT, spacing: { before: 140 } }),
              ],
            }),
          ] })],
        }));
      }
    }

    // ── Kenntnisse ──
    if (skills.length) {
      children.push(sectionHeading(H.skills, theme));
      // Each skill as an inline chip (plain text, comma-separated — reliable across all Word versions)
      children.push(new Paragraph({
        children: skills.map((s: any, i: number) => [
          i > 0 ? new TextRun({ text: "   |   ", size: 20, font: FONT, color: "9CA3AF" }) : null,
          new TextRun({ text: cleanText(s.name || String(s)), size: 20, font: FONT }),
        ]).flat().filter(Boolean) as TextRun[],
        spacing: { after: 100 },
      }));
    }

    // ── Sprachen ──
    if (languages.length) {
      children.push(sectionHeading(H.languages, theme));
      for (const lang of languages) {
        children.push(new Paragraph({
          children: [bold(lang.language || "", 21), ...(lang.level ? [normal(`  —  ${lang.level}`, 21)] : [])],
          spacing: { after: 60 },
        }));
      }
    }

    // ── Signature line ──
    const city = p.city || "";
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    children.push(new Paragraph({
      children: [normal(city ? (String(pd?.language || "de") === "de" ? `${city}, den ${today}` : `${city}, ${today}`) : today, 20)],
      spacing: { before: 400, after: 40 },
    }));
    if (fullName) {
      children.push(new Paragraph({ children: [muted(fullName, 19)], spacing: { after: 0 } }));
    }

    const wordDoc = new Document({
      sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }],
    });

    const buffer = await Packer.toBuffer(wordDoc);
    const safeName = (doc.name || "Lebenslauf").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const asciiName = `${safeName} - Lebenslauf.docx`.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName + " – Lebenslauf.docx")}`);
    res.send(buffer);
  } catch (err: any) {
    req.log.error({ err }, "CV DOCX error");
    res.status(500).json({ error: "Server error" });
  }
});

const VALID_TEMPLATE_IDS = new Set([
  "modern","classic","creative","executive","minimal","elegant",
  "bold","compact","swiss","nordic","corporate","timeline","slate","terra","custom",
  "blobs","welle","halo","splitblock","klammern","winkel","bogen","zweig","berge",
  "konfetti","wellenband","farbkreis","blobcorner","aurora","prisma","verlaufswelle",
  "blaupause","technik","raster",
]);

function isValidCvJson(cv: unknown): boolean {
  if (typeof cv !== "object" || Array.isArray(cv) || !cv) return false;
  const o = cv as Record<string, unknown>;
  for (const field of ["name","title","contact","profile","signature"]) {
    if (o[field] !== undefined && typeof o[field] !== "string") return false;
  }
  for (const field of ["experience","education","skills","languages"]) {
    if (o[field] !== undefined && !Array.isArray(o[field])) return false;
  }
  return true;
}

// ── CV DOCX from editor (cv_json) ────────────────────────────────────────────
router.post("/documents/:id/download/cv.docx", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const documentId = String(req.params.id);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    const storedProfileData = (doc.profileData as any) || {};
    if (storedProfileData.documentTypes?.cv === false || (!doc.cvHtml && !storedProfileData.cv_json)) {
      res.status(404).json({ error: "No CV stored" });
      return;
    }
    if (!doc.bezahlt) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }

    const cv = req.body?.cv_json || storedProfileData.cv_json;
    if (!cv) { res.status(400).json({ error: "No cv_json" }); return; }
    if (!isValidCvJson(cv)) { res.status(400).json({ error: "Invalid cv_json structure" }); return; }

    const theme = themeFor(req.body?.template && VALID_TEMPLATE_IDS.has(req.body.template) ? req.body.template : doc.template, (doc.profileData as any));
    const H = headingsFor(doc.profileData as any);
    const children: any[] = [];
    children.push(topBar(theme));

    // Header
    children.push(new Paragraph({
      children: [new TextRun({ text: cleanText((cv.name || "").toUpperCase()), bold: true, size: 40, font: FONT, characterSpacing: 40, color: theme.accent })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }));
    if (cv.title) {
      children.push(new Paragraph({
        children: [muted(cv.title, 22)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }));
    }
    if (cv.contact) {
      children.push(new Paragraph({
        children: [muted(cv.contact.replace(/·/g, "  ·  "), 18)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }));
    }
    children.push(hr(theme));

    // Profil
    if (cv.profile) {
      children.push(sectionHeading(H.profile, theme));
      children.push(new Paragraph({ children: [normal(cv.profile, 21)], spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED }));
    }

    // Ausbildung
    if (cv.education?.length) {
      children.push(sectionHeading(H.education, theme));
      for (const edu of cv.education) {
        children.push(new Table({
          width: { size: 10106, type: WidthType.DXA },
          columnWidths: [7883, 2223],
          layout: TableLayoutType.FIXED,
          borders: NO_BORDERS_TABLE,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 7883, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: [
                new Paragraph({ children: [bold(edu.degree || "", 22)], spacing: { before: 140, after: 30 } }),
                new Paragraph({ children: [muted([edu.institution, edu.location, edu.note].filter(Boolean).join("  ·  "), 20)], spacing: { after: 80 } }),
              ],
            }),
            new TableCell({
              width: { size: 2223, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: [new Paragraph({ children: [muted(edu.period || "", 18)], alignment: AlignmentType.RIGHT, spacing: { before: 140 } })],
            }),
          ] })],
        }));
      }
    }

    // Berufserfahrung
    if (cv.experience?.length) {
      children.push(sectionHeading(H.experience, theme));
      for (const exp of cv.experience) {
        const companyLine = [exp.company, exp.location].filter(Boolean).join(", ");
        const bullets: string[] = Array.isArray(exp.bullets) ? exp.bullets : [];
        children.push(new Table({
          width: { size: 10106, type: WidthType.DXA },
          columnWidths: [7883, 2223],
          layout: TableLayoutType.FIXED,
          borders: NO_BORDERS_TABLE,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 7883, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: [
                new Paragraph({ children: [bold(exp.position || "", 22)], spacing: { before: 140, after: 30 } }),
                new Paragraph({ children: [muted(companyLine, 20)], spacing: { after: 50 } }),
                ...bullets.map((line: string) =>
                  new Paragraph({
                    children: [normal("• " + line.replace(/^[-•·]\s*/, ""), 20)],
                    spacing: { after: 30 },
                    indent: { left: 120 },
                  })
                ),
              ],
            }),
            new TableCell({
              width: { size: 2223, type: WidthType.DXA },
              borders: NO_BORDERS_CELL,
              children: [new Paragraph({ children: [muted(exp.period || "", 18)], alignment: AlignmentType.RIGHT, spacing: { before: 140 } })],
            }),
          ] })],
        }));
      }
    }

    // Kenntnisse
    if (cv.skills?.length) {
      children.push(sectionHeading(H.skills, theme));
      children.push(new Paragraph({
        children: cv.skills.map((s: string, i: number) => [
          i > 0 ? new TextRun({ text: "   |   ", size: 20, font: FONT, color: "9CA3AF" }) : null,
          new TextRun({ text: cleanText(typeof s === "string" ? s : (s as any).name || ""), size: 20, font: FONT }),
        ]).flat().filter(Boolean) as TextRun[],
        spacing: { after: 100 },
      }));
    }

    // Sprachen
    if (cv.languages?.length) {
      children.push(sectionHeading(H.languages, theme));
      for (const lang of cv.languages) {
        children.push(new Paragraph({
          children: [bold(lang.name || "", 21), normal(`  —  ${lang.level || ""}`, 21)],
          spacing: { after: 60 },
        }));
      }
    }

    // Signature
    if (cv.signature) {
      children.push(new Paragraph({ children: [normal(cv.signature, 20)], spacing: { before: 400, after: 0 } }));
    }

    const wordDoc = new Document({
      sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }],
    });
    const buffer = await Packer.toBuffer(wordDoc);
    const safeName = (doc.name || "Lebenslauf").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const asciiName = `${safeName} - Lebenslauf.docx`.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName + " – Lebenslauf.docx")}`);
    res.send(buffer);
  } catch (err: any) {
    req.log.error({ err }, "CV DOCX (cv_json) error");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Cover Letter DOCX ─────────────────────────────────────────────────────────
router.get("/documents/:id/download/cover-letter.docx", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const documentId = String(req.params.id);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, documentId), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }
    if (!doc.bezahlt) {
      res.status(403).json({ error: "upgrade_required" });
      return;
    }

    const pd = (doc.profileData as any) || {};
    const p = pd.personal || {};
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "";
    const theme = themeFor(doc.template, (doc.profileData as any));
    const H = headingsFor(doc.profileData as any);

    // Use edited text if provided via query param (client sends updated text), else stored text.
    // Locked free users may only export the stored original.
    const allowOverride = doc.bezahlt;
    const letterText: string = (allowOverride && (req.query.text as string)) || doc.coverLetter || "";
    if (!letterText.trim()) { res.status(404).json({ error: "No cover letter" }); return; }

    const children: any[] = [];
    children.push(topBar(theme));

    if (fullName) {
      children.push(new Paragraph({
        children: [new TextRun({ text: cleanText(fullName.toUpperCase()), bold: true, size: 32, font: FONT, characterSpacing: 60, color: theme.accent })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }));
      children.push(hr(theme));
      children.push(new Paragraph({ children: [], spacing: { after: 200 } }));
    }

    // Cover letter paragraphs
    const lines = letterText.split(/\n/);
    for (const line of lines) {
      children.push(new Paragraph({
        children: [new TextRun({ text: cleanText(line), size: 22, font: FONT })],
        spacing: { after: line.trim() === "" ? 80 : 120 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }

    const docx = new Document({
      sections: [{ properties: { page: { margin: { top: 800, right: 900, bottom: 800, left: 900 } } }, children }],
    });

    const buffer = await Packer.toBuffer(docx);
    const safeName = (doc.name || "Anschreiben").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const asciiName = `${safeName} - Anschreiben.docx`.replace(/[^\x20-\x7E]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName + " – Anschreiben.docx")}`);
    res.send(buffer);
  } catch (err: any) {
    req.log.error({ err }, "Cover letter DOCX error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
