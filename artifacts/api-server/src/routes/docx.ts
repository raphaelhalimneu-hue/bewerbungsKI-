import { Router } from "express";
import {
  Document, Paragraph, TextRun, Packer,
  AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType,
} from "docx";
import { db, documentsTable, profilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
function bold(text: string, size = 22) {
  return new TextRun({ text, bold: true, size, font: "Helvetica" });
}
function normal(text: string, size = 22) {
  return new TextRun({ text, size, font: "Helvetica" });
}
function muted(text: string, size = 20) {
  return new TextRun({ text, size, color: "6B7280", font: "Helvetica" });
}
function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F2937" } },
    spacing: { before: 200, after: 200 },
    children: [],
  });
}
function section(title: string) {
  return new Paragraph({
    children: [bold(title.toUpperCase(), 20)],
    spacing: { before: 300, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" } },
  });
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
    const experience = pd.experience || [];
    const education = pd.education || [];
    const skills = pd.skills || [];
    const languages = pd.languages || [];
    const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Name";

    const children: any[] = [
      // Name heading
      new Paragraph({
        children: [new TextRun({ text: fullName.toUpperCase(), bold: true, size: 36, font: "Helvetica", characterSpacing: 60 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
      p.title ? new Paragraph({
        children: [muted(p.title.toUpperCase(), 20)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }) : null,
      new Paragraph({
        children: [muted([p.city, p.phone, p.email].filter(Boolean).join("  ·  "), 18)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }),
      hr(),
    ].filter(Boolean);

    // Experience
    if (experience.length) {
      children.push(section("Berufserfahrung"));
      for (const exp of experience) {
        const period = [exp.start, exp.current ? "heute" : exp.end].filter(Boolean).join(" – ");
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 } },
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }, children: [
              new Paragraph({ children: [bold(exp.position || "Position")], spacing: { before: 160, after: 40 } }),
              new Paragraph({ children: [muted(`${exp.company || "Firma"}${exp.city ? ", " + exp.city : ""}`)], spacing: { after: 60 } }),
              ...(exp.description ? exp.description.split(/\n/).filter(Boolean).map((line: string) =>
                new Paragraph({ children: [normal("• " + line.replace(/^[-•]\s*/, ""))], spacing: { after: 40 } })
              ) : []),
            ] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }, children: [
              new Paragraph({ children: [muted(period, 18)], alignment: AlignmentType.RIGHT, spacing: { before: 160 } }),
            ] }),
          ] })],
        }));
      }
    }

    // Education
    if (education.length) {
      children.push(section("Ausbildung"));
      for (const edu of education) {
        const period = [edu.start, edu.end].filter(Boolean).join(" – ");
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 } },
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }, children: [
              new Paragraph({ children: [bold(edu.degree || "Abschluss")], spacing: { before: 160, after: 40 } }),
              new Paragraph({ children: [muted(`${edu.school || "Schule"}${edu.field ? " – " + edu.field : ""}`)], spacing: { after: 80 } }),
            ] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } }, children: [
              new Paragraph({ children: [muted(period, 18)], alignment: AlignmentType.RIGHT, spacing: { before: 160 } }),
            ] }),
          ] })],
        }));
      }
    }

    // Skills & Languages
    if (skills.length || languages.length) {
      children.push(section("Kenntnisse & Sprachen"));
      if (skills.length) {
        children.push(new Paragraph({
          children: skills.map((s: any, i: number) => new TextRun({
            text: (i > 0 ? "   " : "") + (s.name || s),
            size: 20,
            font: "Helvetica",
            shading: { fill: "F3F4F6" },
          })),
          spacing: { after: 120 },
        }));
      }
      if (languages.length) {
        for (const lang of languages) {
          children.push(new Paragraph({
            children: [bold(`${lang.language || ""}`, 20), normal(`  —  ${lang.level || ""}`, 20)],
            spacing: { after: 60 },
          }));
        }
      }
    }

    const doc2 = new Document({
      sections: [{ properties: { page: { margin: { top: 800, right: 900, bottom: 800, left: 900 } } }, children }],
    });

    const buffer = await Packer.toBuffer(doc2);
    const safeName = (doc.name || "Lebenslauf").replace(/[^\w\-_äöüÄÖÜß ]/g, "");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName} – Lebenslauf.docx"`);
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
