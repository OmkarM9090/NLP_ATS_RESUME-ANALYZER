"use client";

import { useCallback, useState } from "react";

import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { useAnalysisStore } from "@/stores/analysisStore";
import type { AnalysisResponse } from "@/types";
import type { AnalyzeOptions } from "@/lib/api";

export type SlotName = "resume" | "job_description";

export interface SlotState {
  file: File | null;
  error: string | null;
}

export interface UseAnalysisRunner {
  slots: Record<SlotName, SlotState>;
  status: ReturnType<typeof useAnalysisStore.getState>["status"];
  percent: number;
  stageIndex: number;
  uploadPercent: number;
  result: AnalysisResponse | null;
  isBusy: boolean;
  canSubmit: boolean;
  setFile: (slot: SlotName, file: File | null) => string | null;
  clearSlot: (slot: SlotName) => void;
  clearAll: () => void;
  submit: (options?: AnalyzeOptions) => Promise<AnalysisResponse | null>;
}

const EMPTY_SLOT: SlotState = { file: null, error: null };

/** Validate one upload against the same rules the backend enforces. */
export function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";

  if (!file.size) return "That file is empty (0 bytes).";
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type "${extension || "unknown"}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `That file is ${formatBytes(file.size)}, over the ${MAX_FILE_SIZE_MB} MB limit.`;
  }
  return null;
}

/**
 * Owns the two upload slots, client-side validation and the run itself.
 *
 * Everything the /analyze page needs lives here so the component stays presentational.
 */
export function useAnalysisRunner(): UseAnalysisRunner {
  const [slots, setSlots] = useState<Record<SlotName, SlotState>>({
    resume: EMPTY_SLOT,
    job_description: EMPTY_SLOT,
  });

  const status = useAnalysisStore((state) => state.status);
  const percent = useAnalysisStore((state) => state.percent);
  const stageIndex = useAnalysisStore((state) => state.stageIndex);
  const uploadPercent = useAnalysisStore((state) => state.uploadPercent);
  const result = useAnalysisStore((state) => state.result);
  const run = useAnalysisStore((state) => state.run);
  const reset = useAnalysisStore((state) => state.reset);

  const setFile = useCallback((slot: SlotName, file: File | null): string | null => {
    const error = file ? validateFile(file) : null;
    setSlots((previous) => ({ ...previous, [slot]: { file: error ? null : file, error } }));
    return error;
  }, []);

  const clearSlot = useCallback((slot: SlotName) => {
    setSlots((previous) => ({ ...previous, [slot]: EMPTY_SLOT }));
  }, []);

  const clearAll = useCallback(() => {
    setSlots({ resume: EMPTY_SLOT, job_description: EMPTY_SLOT });
    reset();
  }, [reset]);

  const submit = useCallback(
    async (options: AnalyzeOptions = {}): Promise<AnalysisResponse | null> => {
      const resume = slots.resume.file;
      const jobDescription = slots.job_description.file;
      if (!resume || !jobDescription) return null;
      try {
        return await run(resume, jobDescription, options);
      } catch {
        // The store already surfaced the error via a toast.
        return null;
      }
    },
    [run, slots.job_description.file, slots.resume.file],
  );

  return {
    slots,
    status,
    percent,
    stageIndex,
    uploadPercent,
    result,
    isBusy: status === "uploading" || status === "analyzing",
    canSubmit: Boolean(slots.resume.file && slots.job_description.file) && status !== "analyzing" && status !== "uploading",
    setFile,
    clearSlot,
    clearAll,
    submit,
  };
}
