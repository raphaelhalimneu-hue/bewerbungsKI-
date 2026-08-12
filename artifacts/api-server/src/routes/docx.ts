import { Router } from "express";
import {
  Document, Paragraph, TextRun, Packer,
  AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType,
} from "docx";
import { db, documentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
const FONT = "Calibri";
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "auto" };
const NO_BORDERS_TABLE = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideH: NO_BORDER, insideV: NO_BORDER };
const NO_BORDERS_CELL = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function bold(text: string, size = 22) {
  return new TextRun({ text, bold: true, size, font: FONT });
}
function normal(text: string, size = 22) {
  return new TextRun({ text, size, font: FONT });
}
function muted(text: string, size = 20) {
  return new TextRun({ text, size, color: "6B7280", font: FONT });
}
function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1F2937" } },
    spacing: { before: 160, after: 160 },
    children: [],
  });
}
function sectionHeading(title: string) {
  return new Paragraph({
    children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 19, font: FONT, color: "1F2937" })],
    spacing: { before: 280, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" } },
  });
}
function formatPeriod(start?: string, end?: string, current?: boolean): string {
  const fmt = (d: string) => {
    if (!d) return "";
    // "2021-03" → "03/2021", "2021" → "2021"
    const parts = d.split("-");
    return parts.length >= 2 ? `${parts[1]}/${parts[0]}` : parts[0];
  };
  const s = fmt(start || "");
  const e = current ? "heute" : fmt(end || "");
  return [s, e].filter(Boolean).join(" – ");
}

// ── CV DOCX ──────────────────────────────────────────────────────────────────
router.get("/documents/:id/download/cv.docx", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }

    const pd = (doc.profileData as any) || {};
    const p = pd.personal || {};
    const experience: any[] = pd.experience || [];
    const education: any[] = pd.education || [];
    const skills: any[] = pd.skills || [];
    const languages: any[] = pd.languages || [];
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Name";

    // Contact line: address | phone | email | linkedin
    const contactParts = [
      [p.address, p.zip, p.city].filter(Boolean).join(" "),
      p.phone,
      p.email,
      p.linkedin,
    ].filter(Boolean);

    const children: any[] = [];

    // ── Header ──
    children.push(new Paragraph({
      children: [new TextRun({ text: fullName.toUpperCase(), bold: true, size: 40, font: FONT, characterSpacing: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }));
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
    children.push(hr());

    // ── Profil ──
    if (p.summary) {
      children.push(sectionHeading("Profil"));
      children.push(new Paragraph({
        children: [normal(p.summary, 21)],
        spacing: { after: 80 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }

    // ── Berufserfahrung ──
    if (experience.length) {
      children.push(sectionHeading("Berufserfahrung"));
      for (const exp of experience) {
        const period = formatPeriod(exp.start, exp.end, exp.current);
        const companyLine = [exp.company, exp.city].filter(Boolean).join(", ");
        const descLines: string[] = exp.description
          ? exp.description.split(/\n/).map((l: string) => l.trim()).filter(Boolean)
          : [];

        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: NO_BORDERS_TABLE,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 78, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS_CELL,
              children: [
                new Paragraph({ children: [bold(exp.position || "Position", 22)], spacing: { before: 140, after: 30 } }),
                new Paragraph({ children: [muted(companyLine, 20)], spacing: { after: 50 } }),
                ...descLines.map((line: string) =>
                  new Paragraph({
                    children: [normal("• " + line.replace(/^[-•·]\s*/, ""), 20)],
                    spacing: { after: 30 },
                    indent: { left: 120 },
                  })
                ),
              ],
            }),
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
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
      children.push(sectionHeading("Ausbildung"));
      for (const edu of education) {
        const period = formatPeriod(edu.start, edu.end);
        // institution field (not school)
        const institutionLine = [edu.institution, edu.city].filter(Boolean).join(", ");
        const degreeLine = [edu.degree, edu.field].filter(Boolean).join(" – ");

        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: NO_BORDERS_TABLE,
          rows: [new TableRow({ children: [
            new TableCell({
              width: { size: 78, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS_CELL,
              children: [
                new Paragraph({ children: [bold(degreeLine || "Abschluss", 22)], spacing: { before: 140, after: 30 } }),
                new Paragraph({ children: [muted(institutionLine, 20)], spacing: { after: 80 } }),
              ],
            }),
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
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
      children.push(sectionHeading("Kenntnisse"));
      // Each skill as an inline chip (plain text, comma-separated — reliable across all Word versions)
      children.push(new Paragraph({
        children: skills.map((s: any, i: number) => [
          i > 0 ? new TextRun({ text: "   |   ", size: 20, font: FONT, color: "9CA3AF" }) : null,
          new TextRun({ text: s.name || String(s), size: 20, font: FONT }),
        ]).flat().filter(Boolean) as TextRun[],
        spacing: { after: 100 },
      }));
    }

    // ── Sprachen ──
    if (languages.length) {
      children.push(sectionHeading("Sprachen"));
      for (const lang of languages) {
        children.push(new Paragraph({
          children: [bold(lang.language || "", 21), normal(`  —  ${lang.level || ""}`, 21)],
          spacing: { after: 60 },
        }));
      }
    }

    // ── Signature line ──
    const city = p.city || "Ort";
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    children.push(new Paragraph({
      children: [normal(`${city}, den ${today}`, 20)],
      spacing: { before: 400, after: 40 },
    }));
    children.push(new Paragraph({ children: [muted(fullName, 19)], spacing: { after: 0 } }));

    const wordDoc = new Document({
      sections: [{ properties: { page: { margin: { top: 720, right: 900, bottom: 720, left: 900 } } }, children }],
    });

    const buffer = await Packer.toBuffer(wordDoc);
    const safeName = (doc.name || "Lebenslauf").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName} – Lebenslauf.docx"; filename*=UTF-8''${encodeURIComponent(safeName + " – Lebenslauf.docx")}`);
    res.send(buffer);
  } catch (err: any) {
    req.log.error({ err }, "CV DOCX error");
    res.status(500).json({ error: "Server error" });
  }
});

// ── Cover Letter DOCX ─────────────────────────────────────────────────────────
router.get("/documents/:id/download/cover-letter.docx", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));

    if (!doc) { res.status(404).json({ error: "Not found" }); return; }

    const pd = (doc.profileData as any) || {};
    const p = pd.personal || {};
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "";

    // Use edited text if provided via query param (client sends updated text), else stored text
    const letterText: string = (req.query.text as string) || doc.coverLetter || "";
    if (!letterText.trim()) { res.status(404).json({ error: "No cover letter" }); return; }

    const children: any[] = [];

    if (fullName) {
      children.push(new Paragraph({
        children: [new TextRun({ text: fullName.toUpperCase(), bold: true, size: 32, font: "Helvetica", characterSpacing: 60 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }));
      children.push(hr());
      children.push(new Paragraph({ children: [], spacing: { after: 200 } }));
    }

    // Cover letter paragraphs
    const lines = letterText.split(/\n/);
    for (const line of lines) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22, font: "Helvetica" })],
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
    res.setHeader("Content-Disposition", `attachment; filename="${safeName} – Anschreiben.docx"`);
    res.send(buffer);
  } catch (err: any) {
    req.log.error({ err }, "Cover letter DOCX error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
