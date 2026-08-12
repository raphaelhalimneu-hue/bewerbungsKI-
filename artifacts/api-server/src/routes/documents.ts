import { Router } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

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

    res.json({
      id: doc.id,
      name: doc.name,
      template: doc.template,
      cv_html: doc.cvHtml,
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

router.post("/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, template, profileData, cvHtml, coverLetter, jobTitle, jobCompany } = req.body;

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
