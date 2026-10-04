"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { BackendHealth } from "@/hooks/useBackendHealth";
import { IconAlert, IconClose, IconInfo } from "@/components/ui/Icons";

/**
 * Thin banner under the navbar that surfaces backend problems *before* the user
 * uploads anything: unreachable service, or degraded (fallback models) mode.
 *
 * Dismissible per state — the dismissal resets when the state changes.
 */
export function BackendStatusBanner({ health }: { health: BackendHealth }) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  const state =
    health.online === false
      ? {
          key: "offline",
          tone: "danger" as const,
          title: "Analysis service unreachable",
          body: health.error ?? "The FastAPI backend did not respond on /api/health.",
        }
      : health.degraded
        ? {
            key: "degraded",
            tone: "warning" as const,
            title: "Running with fallback models",
            body: describeDegradation(health),
          }
        : null;

  if (!state || dismissed === state.key) return null;

  const styles = {
    danger: "border-danger/40 bg-danger/10 text-danger",
    warning: "border-warning/40 bg-warning/10 text-warning",
  }[state.tone];

  return (
    <AnimatePresence>
      <motion.div
        key={state.key}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="no-print fixed inset-x-0 top-[72px] z-40 overflow-hidden"
      >
        <div className="section-inner py-2">
          <div className={`flex items-start gap-3 rounded-card border px-4 py-3 backdrop-blur-md ${styles}`}>
            <span className="mt-0.5 shrink-0">
              {state.tone === "danger" ? <IconAlert size={17} /> : <IconInfo size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold">{state.title}</p>
              <p className="mt-0.5 text-small leading-relaxed opacity-85">{state.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(state.key)}
              className="shrink-0 rounded-button p-1 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss status message"
            >
              <IconClose size={15} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function describeDegradation(health: BackendHealth): string {
  const models = health.data?.models ?? {};
  const notes: string[] = [];

  const spacy = models.spacy;
  if (spacy && spacy.loaded && spacy.variant !== "statistical") {
    notes.push("spaCy is using the offline heuristic pipeline");
  }
  const encoder = models.sentence_transformer;
  if (encoder && !encoder.loaded) {
    notes.push("semantic similarity falls back to TF-IDF/LSA");
  }
  if (health.data && health.data.ocr_available === false) {
    notes.push("OCR is unavailable, so scanned PDFs cannot be read");
  }

  if (!notes.length) return "Some models reported a non-optimal state. Scores stay comparable.";
  return `${notes.join("; ")}. Scores remain comparable but are less nuanced.`;
}
