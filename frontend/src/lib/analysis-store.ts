import type { AnalysisResponse } from "../types/analysis";

/*
 * Server-side API proxy to the Python backend for analysis history.
 * These helpers run on the Next.js server (React Server Components), so they
 * talk to the FastAPI service directly. The browser never calls the backend
 * host itself — client code uses the relative `/api/*` URLs proxied by the
 * rewrites in next.config.ts.
 */

const isProd = process.env.NODE_ENV === "production";
const API_BASE =
  process.env.API_BASE_URL ||
  `${process.env.BACKEND_URL || (isProd ? "https://hirelens-mvf4.onrender.com" : "http://127.0.0.1:8000")}/api`;

export interface HistoryRow {
  id: string;
  createdAt: Date;
  overallScore: number;
  grade: string;
  resumeFilename: string;
  jdFilename: string;
}

export async function saveAnalysis(result: AnalysisResponse): Promise<string> {
  // The Python backend already persists analyses on generation, so the
  // frontend doesn't need to double-save.
  return result.id;
}

export async function listAnalyses(
  page: number,
  limit: number,
): Promise<{ rows: HistoryRow[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/history?page=${page}&page_size=${limit}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  const data: {
    items?: Array<{
      id: string;
      timestamp: string;
      overall_score: number;
      grade?: string;
      resume_filename?: string;
      jd_filename?: string;
    }>;
    total?: number;
  } = await res.json();

  const rows: HistoryRow[] = (data.items ?? []).map((item) => ({
    id: item.id,
    createdAt: new Date(item.timestamp),
    overallScore: item.overall_score,
    grade: item.grade ?? "C",
    resumeFilename: item.resume_filename || "resume",
    jdFilename: item.jd_filename || "job description",
  }));

  return { rows, total: data.total ?? rows.length };
}

export async function getAnalysisById(
  id: string,
): Promise<AnalysisResponse | null> {
  const res = await fetch(`${API_BASE}/history/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as AnalysisResponse;
}

export async function deleteAnalysisById(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/history/${id}`, {
    method: "DELETE",
  });
  return res.ok;
}
