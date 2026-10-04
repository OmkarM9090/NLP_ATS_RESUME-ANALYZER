"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { ApiError, analyzeDocuments, getHistoryItem, toApiError, type AnalyzeOptions } from "@/lib/api";
import { PIPELINE_STAGES } from "@/lib/constants";
import { toast } from "@/stores/toastStore";
import type { AnalysisResponse } from "@/types";

/* -------------------------------------------------------------------------- */
/* Progress pacing                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The backend runs the whole pipeline inside one request, so the client walks
 * the real stage list on a timer and never claims more than 92% until the
 * response lands. `expectedMs` is calibrated from measured runs (~1.2 s warm,
 * ~4 s cold) and stretches out gracefully when a run takes longer.
 */
const EXPECTED_MS = 6000;
const MAX_AUTO_PROGRESS = 92;

interface ProgressState {
  /** 0-100, monotonically increasing while a run is in flight. */
  percent: number;
  /** Index into PIPELINE_STAGES of the stage currently on screen. */
  stageIndex: number;
  /** Upload progress (multipart body streaming), 0-100. */
  uploadPercent: number;
}

const IDLE_PROGRESS: ProgressState = { percent: 0, stageIndex: -1, uploadPercent: 0 };

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "success" | "error";

interface AnalysisState extends ProgressState {
  status: AnalysisStatus;
  result: AnalysisResponse | null;
  error: ApiError | null;
  /** Filenames of the last analysed pair, shown in the results header. */
  resumeFilename: string | null;
  jdFilename: string | null;
  /** True when the result was loaded from history rather than a fresh run. */
  fromHistory: boolean;
  startedAt: number | null;

  run: (resume: File, jobDescription: File, options?: AnalyzeOptions) => Promise<AnalysisResponse>;
  loadFromHistory: (id: string) => Promise<AnalysisResponse>;
  setResult: (result: AnalysisResponse | null) => void;
  setStage: (key: string, percent: number) => void;
  setUploadProgress: (percent: number) => void;
  reset: () => void;
}

/** Server-side placeholder so `createJSONStorage` never touches a real Storage. */
const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

let ticker: ReturnType<typeof setInterval> | null = null;
let tickStart = 0;

function stopTicker(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function stageIndexForPercent(percent: number): number {
  let index = 0;
  for (let i = 0; i < PIPELINE_STAGES.length; i += 1) {
    if ((PIPELINE_STAGES[i]?.progress ?? 0) <= percent) index = i;
  }
  return index;
}

/**
 * The single place that knows the current stage, so both the timed walker and
 * the real completion event agree.
 */
export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      ...IDLE_PROGRESS,
      status: "idle",
      result: null,
      error: null,
      resumeFilename: null,
      jdFilename: null,
      fromHistory: false,
      startedAt: null,

      run: async (resume, jobDescription, options = {}) => {
        stopTicker();
        tickStart = Date.now();
        set({
          ...IDLE_PROGRESS,
          status: "uploading",
          error: null,
          result: null,
          fromHistory: false,
          resumeFilename: resume.name,
          jdFilename: jobDescription.name,
          startedAt: tickStart,
        });

        // Ease through the real stage list while the request is in flight.
        ticker = setInterval(() => {
          const elapsed = Date.now() - tickStart;
          // Asymptotic approach to MAX_AUTO_PROGRESS: fast start, slow tail.
          const ratio = 1 - Math.exp(-(elapsed / EXPECTED_MS) * 2.6);
          const percent = Math.min(MAX_AUTO_PROGRESS, Math.round(ratio * MAX_AUTO_PROGRESS));
          set({ percent, stageIndex: stageIndexForPercent(percent), status: "analyzing" });
        }, 90);

        try {
          const result = await analyzeDocuments(resume, jobDescription, {
            ...options,
            onUploadProgress: (percent) => {
              set({ uploadPercent: percent });
              if (percent >= 100) set({ status: "analyzing" });
            },
          });
          stopTicker();
          const stages = result.nlp_metadata?.pipeline_stages_completed ?? [];
          set({
            status: "success",
            result,
            error: null,
            percent: 100,
            stageIndex: PIPELINE_STAGES.length - 1,
            uploadPercent: 100,
            resumeFilename: result.resume_filename || resume.name,
            jdFilename: result.jd_filename || jobDescription.name,
            fromHistory: false,
          });

          if (result.nlp_metadata?.degraded_mode) {
            toast.warning(
              "Running with fallback models",
              result.nlp_metadata.warnings[0] ??
                "Some NLP weights were unavailable, so accuracy is reduced.",
            );
          } else {
            toast.success(
              `Analysis complete — ${result.overall_score.toFixed(1)} (${result.grade})`,
              `${stages.length} pipeline stages in ${(
                (result.nlp_metadata?.processing_time_ms ?? 0) / 1000
              ).toFixed(2)}s`,
            );
          }
          return result;
        } catch (error) {
          stopTicker();
          const apiError = toApiError(error);
          set({ status: "error", error: apiError, result: null });
          toast.error(apiError.userMessage, apiError.detail ?? undefined);
          throw apiError;
        }
      },

      loadFromHistory: async (id) => {
        stopTicker();
        set({ status: "analyzing", error: null, percent: 40, stageIndex: 0 });
        try {
          const result = await getHistoryItem(id);
          set({
            status: "success",
            result,
            percent: 100,
            stageIndex: PIPELINE_STAGES.length - 1,
            uploadPercent: 100,
            fromHistory: true,
            resumeFilename: result.resume_filename,
            jdFilename: result.jd_filename,
          });
          return result;
        } catch (error) {
          const apiError = toApiError(error);
          set({ status: "error", error: apiError });
          toast.error(apiError.userMessage, apiError.detail ?? undefined);
          throw apiError;
        }
      },

      setResult: (result) =>
        set({
          result,
          status: result ? "success" : "idle",
          resumeFilename: result?.resume_filename ?? null,
          jdFilename: result?.jd_filename ?? null,
        }),

      setStage: (key, percent) => {
        const index = PIPELINE_STAGES.findIndex((stage) => stage.key === key);
        set({
          percent: Math.max(get().percent, percent),
          stageIndex: index >= 0 ? index : get().stageIndex,
        });
      },

      setUploadProgress: (percent) => set({ uploadPercent: percent }),

      reset: () => {
        stopTicker();
        set({
          ...IDLE_PROGRESS,
          status: "idle",
          result: null,
          error: null,
          resumeFilename: null,
          jdFilename: null,
          fromHistory: false,
          startedAt: null,
        });
      },
    }),
    {
      name: "ats-analysis",
      // sessionStorage: results survive a refresh of /results but not a new tab,
      // which keeps large payloads out of localStorage quotas.
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (noopStorage as unknown as Storage)
          : window.sessionStorage,
      ),
      // Only the finished result is worth persisting; transient state is not.
      partialize: (state) => ({
        result: state.result,
        resumeFilename: state.resumeFilename,
        jdFilename: state.jdFilename,
        fromHistory: state.fromHistory,
        status: state.status === "success" ? ("idle" as AnalysisStatus) : ("idle" as AnalysisStatus),
        percent: 0,
        stageIndex: -1,
        uploadPercent: 0,
        error: null,
        startedAt: null,
      }),
      version: 1,
    },
  ),
);

/** The stage object currently on screen (or null when idle). */
export function selectCurrentStage(state: AnalysisState) {
  if (state.stageIndex < 0) return null;
  return PIPELINE_STAGES[state.stageIndex] ?? null;
}
