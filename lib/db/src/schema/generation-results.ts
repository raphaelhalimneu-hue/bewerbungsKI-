import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const generationResultsTable = pgTable("generation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  batchId: text("batch_id").notNull(),
  type: text("type").notNull(),
  fullText: text("full_text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});