import type { AnalysisResponse } from "@/types/analysis";

/* 
 * API proxy to the Python Backend for analysis history.
 * We fetch from the proxy route (/api/history) which routes to 127.0.0.1:8000
 * but since this runs on the Next.js server, we can just call the Python backend directly
 * or through localhost.
 */

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:8000/api";

export async function saveAnalysis(result: AnalysisResponse): Promise<string> {
  // The Python backend already persists analyses on generation, so the frontend
  // doesn't need to double-save.
  return result.id;
}

export async function listAnalyses(page: number, limit: number) {
  const res = await fetch(`${API_BASE}/history?page=${page}&page_size=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  const data = await res.json();
  
  // Map Python snake_case to Frontend camelCase expectations
  const rows = data.items.map((item: any) => ({
    id: item.id,
    createdAt: new Date(item.timestamp),
    overallScore: item.overall_score,
    resumeFilename: item.resume_filename,
    jdFilename: item.jd_filename,
  }));
  
  return { rows, total: data.total };
}

export async function getAnalysisById(id: string) {
  const res = await fetch(`${API_BASE}/history/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return await res.json();
}

export async function deleteAnalysisById(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/history/${id}`, {
    method: 'DELETE',
  });
  return res.ok;
}
