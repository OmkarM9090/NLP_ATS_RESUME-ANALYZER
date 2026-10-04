import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type { AnalysisResponse } from "@/types/analysis";

export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    overallScore: doublePrecision("overall_score").notNull(),
    resumeFilename: text("resume_filename").notNull(),
    jdFilename: text("jd_filename").notNull(),
    processingTimeMs: integer("processing_time_ms").notNull().default(0),
    result: jsonb("result").$type<AnalysisResponse>().notNull(),
  },
  (t) => [index("analyses_created_at_idx").on(t.createdAt)],
);
