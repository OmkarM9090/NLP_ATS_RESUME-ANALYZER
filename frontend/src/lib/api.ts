import axios, {
  AxiosError,
  AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { API_BASE_URL } from "@/lib/constants";
import type {
  AnalysisListItem,
  AnalysisResponse,
  ApiErrorBody,
  ApiErrorCode,
  DeleteResponse,
  HealthResponse,
  HistoryPage,
  ValidationIssue,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Error type                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every non-2xx response is normalised into this shape so components never have
 * to know whether the backend sent its own envelope or FastAPI's validation one.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId: string | null;
  readonly detail: string | null;
  readonly issues: ValidationIssue[];

  constructor(options: {
    message: string;
    status: number;
    code?: ApiErrorCode | null;
    requestId?: string | null;
    detail?: string | ValidationIssue[] | null;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? statusToCode(options.status);
    this.requestId = options.requestId ?? null;

    if (Array.isArray(options.detail)) {
      this.issues = options.detail;
      this.detail = options.detail.map((issue) => `${issue.field}: ${issue.message}`).join("; ") || null;
    } else {
      this.issues = [];
      this.detail = options.detail ?? null;
    }
  }

  /** True when retrying the identical request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }

  /** Short, user-facing explanation used by toasts and inline errors. */
  get userMessage(): string {
    switch (this.code) {
      case "unsupported_file_type":
        return "That file type is not supported. Upload a PDF, TXT or DOCX.";
      case "file_too_large":
        return "That file is too large. The limit is 10 MB per document.";
      case "empty_file":
        return "That file is empty.";
      case "corrupted_file":
        return "That file looks corrupted — please re-export it and try again.";
      case "encrypted_file":
        return "That file is password protected. Remove the password and retry.";
      case "insufficient_text":
        return "Not enough readable text was found. If it is a scan, OCR support is required.";
      case "pdf_extraction_error":
        return "Text could not be extracted from that document.";
      case "rate_limit_exceeded":
        return "Too many analyses in the last minute. Please wait a moment and try again.";
      case "analysis_timeout":
        return "The analysis timed out. Try a shorter document or retry.";
      case "nlp_processing_error":
      case "model_load_error":
      case "internal_error":
        return "The analysis service hit an unexpected error. Please try again.";
      case "analysis_not_found":
        return "That saved analysis no longer exists.";
      default:
        return this.message;
    }
  }
}

function statusToCode(status: number): ApiErrorCode {
  if (status === 413) return "file_too_large";
  if (status === 415) return "unsupported_file_type";
  if (status === 408) return "analysis_timeout";
  if (status === 429) return "rate_limit_exceeded";
  if (status === 404) return "analysis_not_found";
  if (status === 422) return "validation_error";
  if (status >= 500) return "internal_error";
  return "internal_error";
}

/** Turn any axios/network failure into an {@link ApiError}. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as ApiErrorBody | undefined;
    const requestId =
      (error.response?.headers?.["x-request-id"] as string | undefined) ?? body?.request_id ?? null;

    if (!error.response) {
      // No response at all: network failure, CORS block or client-side timeout.
      const timedOut = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
      return new ApiError({
        message: timedOut
          ? "The analysis took too long and was cancelled."
          : "Could not reach the analysis service. Is the backend running?",
        status: timedOut ? 408 : 0,
        code: timedOut ? "analysis_timeout" : "network_error",
        requestId,
      });
    }

    return new ApiError({
      message: body?.error ?? error.message ?? `Request failed with status ${status}`,
      status,
      code: body?.code ?? statusToCode(status),
      requestId,
      detail: body?.detail ?? null,
    });
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message, status: 0, code: "internal_error" });
  }

  return new ApiError({ message: String(error), status: 0, code: "internal_error" });
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

/** Long timeout: a degraded (heuristic) run on a big PDF can take a while. */
const ANALYZE_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 20_000;

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { Accept: "application/json" },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Per-request timeout for the heavy endpoint.
  if (config.url?.includes("/analyze")) {
    config.timeout = ANALYZE_TIMEOUT_MS;
  }
  return config;
});

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<T>(config);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

export interface AnalyzeOptions {
  /** Override the five score weights (values are renormalised server-side). */
  weights?: Partial<Record<string, number>>;
  /** How many top keywords to return (5-60). */
  topKeywords?: number;
  /** Include the raw text of every parsed section. */
  includeSectionText?: boolean;
  /** Store the run in history (default true). */
  persist?: boolean;
  /** Called with upload progress 0-100 while the request body streams. */
  onUploadProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * `POST /api/analyze` — multipart upload of a resume and a job description.
 */
export function analyzeDocuments(
  resume: File,
  jobDescription: File,
  options: AnalyzeOptions = {},
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("resume", resume, resume.name);
  form.append("job_description", jobDescription, jobDescription.name);

  if (options.weights && Object.keys(options.weights).length > 0) {
    form.append("weights", JSON.stringify(options.weights));
  }
  if (options.topKeywords !== undefined) {
    form.append("top_keywords", String(options.topKeywords));
  }
  if (options.includeSectionText !== undefined) {
    form.append("include_section_text", String(options.includeSectionText));
  }
  if (options.persist !== undefined) {
    form.append("persist", String(options.persist));
  }

  return request<AnalysisResponse>({
    url: "/analyze",
    method: "POST",
    data: form,
    signal: options.signal,
    onUploadProgress: (event) => {
      if (!options.onUploadProgress || !event.total) return;
      options.onUploadProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>({ url: "/health", method: "GET" });
}

export function getModels(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>({ url: "/models", method: "GET" });
}

export function getStats(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>({ url: "/stats", method: "GET" });
}

export function getHistory(page = 1, pageSize?: number): Promise<HistoryPage> {
  return request<HistoryPage>({
    url: "/history",
    method: "GET",
    params: { page, ...(pageSize ? { page_size: pageSize } : {}) },
  });
}

export function getHistoryItem(id: string): Promise<AnalysisResponse> {
  return request<AnalysisResponse>({ url: `/history/${encodeURIComponent(id)}`, method: "GET" });
}

export function deleteHistoryItem(id: string): Promise<DeleteResponse> {
  return request<DeleteResponse>({ url: `/history/${encodeURIComponent(id)}`, method: "DELETE" });
}

export function clearHistory(): Promise<DeleteResponse> {
  return request<DeleteResponse>({ url: "/history", method: "DELETE" });
}

export function purgeHistory(retentionDays?: number): Promise<DeleteResponse> {
  return request<DeleteResponse>({
    url: "/history/purge",
    method: "POST",
    params: retentionDays !== undefined ? { retention_days: retentionDays } : undefined,
  });
}

/** Re-export for consumers that want the list shape without the wrapper. */
export type { AnalysisListItem, HistoryPage };
