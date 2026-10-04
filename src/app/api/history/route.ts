import { listAnalyses } from "@/lib/server/analysis-store";
import type { HistoryResponse } from "@/types/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10),
  );

  try {
    const { rows, total } = await listAnalyses(page, limit);
    const body: HistoryResponse = {
      items: rows.map((r) => ({
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        overall_score: Math.round(r.overallScore * 10) / 10,
        resume_filename: r.resumeFilename,
        jd_filename: r.jdFilename,
      })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
    return Response.json(body);
  } catch (err) {
    console.error("[history] error:", err);
    return Response.json(
      { error: "Could not load analysis history." },
      { status: 500 },
    );
  }
}
