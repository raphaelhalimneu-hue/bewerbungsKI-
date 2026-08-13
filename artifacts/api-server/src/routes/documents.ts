import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { buildDocumentEmail } from "../lib/emailTemplates";

const router = Router();

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
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.id, req.params.id),
          eq(documentsTable.userId, req.userId!)
        )
      );

    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const pd = (doc.profileData as any) || {};
    res.json({
      id: doc.id,
      name: doc.name,
      template: doc.template,
      cv_html: doc.cvHtml,
      cv_json: pd.cv_json ?? null,
      cover_letter: doc.coverLetter,
      profile_data: doc.profileData,
      job_title: doc.jobTitle,
      job_company: doc.jobCompany,
      created_at: doc.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "GET /documents/:id error");
    res.status(500).json({ error: "Server error" });
  }
});

const VALID_TEMPLATES = new Set([
  "modern","classic","creative","executive","minimal","elegant",
  "bold","compact","swiss","nordic","corporate","timeline","slate","terra",
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
    const { cv_html, cv_json, template } = req.body;

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

    const [existing] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, req.params.id), eq(documentsTable.userId, req.userId!)));

    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const updates: Record<string, any> = {};
    if (cv_html !== undefined) updates.cvHtml = cv_html;
    if (template !== undefined) updates.template = template;
    if (cv_json !== undefined) {
      // Merge cv_json into profileData
      const pd = (existing.profileData as any) || {};
      updates.profileData = { ...pd, cv_json };
    }

    await db.update(documentsTable).set(updates).where(eq(documentsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /documents/:id error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, template, profileData, cvHtml, coverLetter, jobTitle, jobCompany, language } = req.body;

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
