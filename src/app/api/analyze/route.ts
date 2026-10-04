import { runFullAnalysis } from "@/lib/nlp/analysis-service";
import { AnalysisError, MAX_FILE_SIZE } from "@/lib/nlp/pdf-extractor";
import { rateLimit } from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/server/analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function POST(req: Request) {
  const rl = rateLimit(`analyze:${getClientIp(req)}`, 12, 60_000);
  if (!rl.ok) {
    return errorResponse(
      429,
      `Too many analyses. Please wait ${rl.retryAfterS}s before trying again.`,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(400, "Expected multipart/form-data with two PDF files.");
  }

  const resumeFile = form.get("resume");
  const jdFile = form.get("job_description");

  if (!(resumeFile instanceof File) || !(jdFile instanceof File)) {
    return errorResponse(
      400,
      "Both files are required: 'resume' and 'job_description' (PDF, max 10MB each).",
    );
  }

  try {
    const [resumeBytes, jdBytes] = await Promise.all([
      resumeFile.arrayBuffer().then((b) => Buffer.from(b)),
      jdFile.arrayBuffer().then((b) => Buffer.from(b)),
    ]);

    const result = await runFullAnalysis(
      { bytes: resumeBytes, filename: resumeFile.name },
      { bytes: jdBytes, filename: jdFile.name },
    );

    // Persist (non-fatal if DB is unavailable — analysis still returns)
    try {
      await saveAnalysis(result);
    } catch (dbErr) {
      console.warn("[analyze] failed to persist analysis:", dbErr);
    }

    return Response.json(result);
  } catch (err) {
    if (err instanceof AnalysisError) {
      return errorResponse(err.status, err.message);
    }
    console.error("[analyze] unexpected error:", err);
    return errorResponse(500, "An unexpected error occurred during analysis.");
  }
}

export async function GET() {
  return Response.json({
    endpoint: "POST /api/analyze",
    accepts: "multipart/form-data",
    fields: {
      resume: `PDF file, max ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      job_description: `PDF file, max ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    },
  });
}
