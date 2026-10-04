"use client";

import { create } from "zustand";
import type { AnalysisResponse } from "@/types/analysis";

const SESSION_KEY = "resumeai:last-analysis";

interface AnalysisState {
  result: AnalysisResponse | null;
  isAnalyzing: boolean;
  step: number;
  progress: number;
  error: string | null;
  setResult: (r: AnalysisResponse) => void;
  startAnalysis: () => void;
  setStep: (step: number, progress: number) => void;
  finishAnalysis: () => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  isAnalyzing: false,
  step: 0,
  progress: 0,
  error: null,
  setResult: (r) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(r));
    } catch {
      /* storage full/blocked — ignore */
    }
    set({ result: r, error: null });
  },
  startAnalysis: () =>
    set({ isAnalyzing: true, step: 0, progress: 4, error: null }),
  setStep: (step, progress) => set({ step, progress }),
  finishAnalysis: () => set({ isAnalyzing: false, step: 4, progress: 100 }),
  setError: (msg) => set({ error: msg, isAnalyzing: false }),
  reset: () =>
    set({ result: null, isAnalyzing: false, step: 0, progress: 0, error: null }),
}));

/** Read the most recent analysis from the session (survives refresh). */
export function loadStoredResult(): AnalysisResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AnalysisResponse) : null;
  } catch {
    return null;
  }
}

export function clearStoredResult() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
