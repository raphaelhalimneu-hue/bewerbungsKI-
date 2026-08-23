import { pgTable, text, timestamp, boolean, jsonb, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  email: text("email").notNull(),
  isPremium: boolean("is_premium").notNull().default(false),
  credits: integer("credits").notNull().default(0),
  freeTrialsUsed: integer("free_trials_used").notNull().default(0),
  // Power package: unlimited applications, perfect capped at 50 lifetime
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  perfectCount: integer("perfect_count").notNull().default(0),
  // Power fair-use: daily rolling counters (YYYY-MM-DD UTC date stored as text)
  dailyPerfectCount: integer("daily_perfect_count").notNull().default(0),
  dailyPerfectDate: text("daily_perfect_date"),   // null = never used
  dailyDocCount: integer("daily_doc_count").notNull().default(0),
  dailyDocDate: text("daily_doc_date"),           // null = never used
  stripeCustomerId: text("stripe_customer_id"),
  // Null = email not yet confirmed (accounts created before this feature were backfilled)
  emailVerifiedAt: timestamp("email_verified_at"),
  savedProfile: jsonb("saved_profile"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  template: text("template").notNull().default("modern"),
  cvHtml: text("cv_html"),
  coverLetter: text("cover_letter"),
  profileData: jsonb("profile_data"),
  jobTitle: text("job_title"),
  jobCompany: text("job_company"),
  // AI-perfected copies for locked free accounts: visible in the preview,
  // never used by any download endpoint (those read cvHtml/coverLetter only).
  perfectedLetter: text("perfected_letter"),
  perfectedCvHtml: text("perfected_cv_html"),
  perfectedGenerationId: uuid("perfected_generation_id"),
  bezahlt: boolean("bezahlt").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Processed Stripe events — guarantees each checkout.session.completed
// grants credits exactly once, even if Stripe redelivers the event.
export const stripeEventsTable = pgTable("stripe_events", {
  id: text("id").primaryKey(), // Stripe event id
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true });

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Document = typeof documentsTable.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// In-app ratings: one rating per user (stars 1-5, optional comment)
export const appRatingsTable = pgTable("app_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
