import { runSampleAnalysis } from "@/lib/nlp/analysis-service";
import { rateLimit } from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/server/analysis-store";
import { AnalysisError } from "@/lib/nlp/pdf-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const rl = rateLimit(`sample:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `Too many requests. Please wait ${rl.retryAfterS}s.` },
      { status: 429 },
    );
  }

  try {
    const result = runSampleAnalysis();
    try {
      await saveAnalysis(result);
    } catch (dbErr) {
      console.warn("[sample] failed to persist analysis:", dbErr);
    }
    return Response.json(result);
  } catch (err) {
    if (err instanceof AnalysisError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[sample] unexpected error:", err);
    return Response.json(
      { error: "Failed to run the sample analysis." },
      { status: 500 },
    );
  }
}
