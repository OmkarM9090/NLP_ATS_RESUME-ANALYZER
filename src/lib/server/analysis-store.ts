import { db } from "@/db";
import { analyses } from "@/db/schema";
import type { AnalysisResponse } from "@/types/analysis";
import { desc, eq, sql } from "drizzle-orm";

/* DB persistence for analysis results. All functions are fail-safe —
 * callers decide whether DB errors are fatal (history) or not (analyze). */

export async function saveAnalysis(result: AnalysisResponse): Promise<string> {
  const [row] = await db
    .insert(analyses)
    .values({
      id: result.id,
      overallScore: result.overall_score,
      resumeFilename: result.filenames.resume,
      jdFilename: result.filenames.job_description,
      processingTimeMs: result.nlp_metadata.processing_time_ms,
      result,
    })
    .returning({ id: analyses.id });
  return row.id;
}

export async function listAnalyses(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: analyses.id,
      createdAt: analyses.createdAt,
      overallScore: analyses.overallScore,
      resumeFilename: analyses.resumeFilename,
      jdFilename: analyses.jdFilename,
    })
    .from(analyses)
    .orderBy(desc(analyses.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analyses);

  return { rows, total: count };
}

export async function getAnalysisById(id: string) {
  const [row] = await db
    .select({ result: analyses.result })
    .from(analyses)
    .where(eq(analyses.id, id))
    .limit(1);
  return row?.result ?? null;
}

export async function deleteAnalysisById(id: string): Promise<boolean> {
  const rows = await db
    .delete(analyses)
    .where(eq(analyses.id, id))
    .returning({ id: analyses.id });
  return rows.length > 0;
}
