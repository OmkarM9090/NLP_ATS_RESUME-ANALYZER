import type {
  AnalysisResponse,
  HealthResponse,
  HistoryResponse,
} from "@/types/analysis";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function analyzeDocuments(
  resume: File,
  jd: File,
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("resume", resume);
  form.append("job_description", jd);
  const res = await fetch("/api/analyze", { method: "POST", body: form });
  return handle<AnalysisResponse>(res);
}

export async function analyzeSample(): Promise<AnalysisResponse> {
  const res = await fetch("/api/sample", { method: "POST" });
  return handle<AnalysisResponse>(res);
}

export async function getHistory(
  page = 1,
  limit = 10,
): Promise<HistoryResponse> {
  const res = await fetch(`/api/history?page=${page}&limit=${limit}`, {
    cache: "no-store",
  });
  return handle<HistoryResponse>(res);
}

export async function getAnalysis(id: string): Promise<AnalysisResponse> {
  const res = await fetch(`/api/history/${id}`, { cache: "no-store" });
  return handle<AnalysisResponse>(res);
}

export async function deleteAnalysis(id: string): Promise<void> {
  const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
  await handle<{ ok: boolean }>(res);
}

export async function healthCheck(): Promise<HealthResponse> {
  const res = await fetch("/api/health", { cache: "no-store" });
  return handle<HealthResponse>(res);
}
