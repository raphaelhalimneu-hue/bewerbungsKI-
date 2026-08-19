import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const perfectedGenerationsTable = pgTable(
  "perfected_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    documentId: uuid("document_id"),
    documentType: text("document_type").notNull(),
    fullText: text("full_text").notNull(),
    previewText: text("preview_text").notNull(),
    fullProfile: text("full_profile"),
    previewProfile: text("preview_profile"),
    changes: jsonb("changes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("perfected_generations_user_created_idx").on(table.userId, table.createdAt),
    index("perfected_generations_document_created_idx").on(table.documentId, table.createdAt),
  ],
);

export const insertPerfectedGenerationSchema = createInsertSchema(perfectedGenerationsTable).omit({
  id: true,
  createdAt: true,
});

export type PerfectedGeneration = typeof perfectedGenerationsTable.$inferSelect;
export type InsertPerfectedGeneration = z.infer<typeof insertPerfectedGenerationSchema>;