"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { PIPELINE_STAGES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/ui/Icons";

export interface AnalysisLoaderProps {
  /** 0-100 overall progress from the analysis store. */
  percent: number;
  /** Index into PIPELINE_STAGES currently on screen. */
  stageIndex: number;
  /** Multipart upload progress (0-100), shown before the pipeline starts. */
  uploadPercent?: number;
  /** Epoch ms when the run started, used for the live elapsed timer. */
  startedAt?: number | null;
  /** Hide the stage list (used in the sticky sidebar on small screens). */
  compact?: boolean;
}

/**
 * Step-by-step pipeline loader.
 *
 * Lists the real backend stages, marking each pending / active / done, with a
 * progress rail and a live elapsed timer. The stage list reveals with GSAP;
 * per-row state changes are CSS transitions so they stay responsive.
 */
export function AnalysisLoader({
  percent,
  stageIndex,
  uploadPercent = 0,
  startedAt = null,
  compact = false,
}: AnalysisLoaderProps) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const elapsed = useElapsedSeconds(startedAt, percent >= 100);
  const activeIndex = Math.max(0, Math.min(stageIndex, PIPELINE_STAGES.length - 1));
  const activeStage = PIPELINE_STAGES[activeIndex];
  const uploading = uploadPercent > 0 && uploadPercent < 100 && stageIndex < 0;

  useGsapContext(
    () => {
      gsap.fromTo(
        "[data-stage-row]",
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.45, ease: "power2.out", stagger: 0.028 },
      );
    },
    { scope: scopeRef, disabled: reducedMotion || compact },
  );

  return (
    <div ref={scopeRef} className="card-raised overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center">
            <span className="absolute inset-0 rounded-pill border border-primary-500/30" />
            {percent < 100 ? (
              <span className="absolute inset-0 animate-pulse-ring rounded-pill" />
            ) : null}
            <span className="h-2.5 w-2.5 rounded-full bg-primary-400" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-ink">
              {percent >= 100
                ? "Analysis complete"
                : uploading
                  ? "Uploading documents"
                  : (activeStage?.label ?? "Analysing")}
            </p>
            <p className="truncate text-small text-ink-muted">
              {percent >= 100
                ? "Rendering your results"
                : uploading
                  ? `${uploadPercent}% of the upload streamed`
                  : (activeStage?.description ?? "Running the NLP pipeline")}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="numeric text-h4 text-ink tabular-nums">{Math.round(percent)}%</p>
          <p className="numeric text-micro text-ink-faint tabular-nums">
            {elapsed.toFixed(1)} s
          </p>
        </div>
      </div>

      {/* Progress rail */}
      <div
        className="relative h-1 w-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Analysis progress"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-r-pill bg-gradient-to-r from-primary-500 via-primary-400 to-secondary-400 transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>

      {!compact ? (
        <ol className="max-h-[42vh] divide-y divide-line/60 overflow-y-auto px-6 py-2 sm:max-h-[52vh]">
          {PIPELINE_STAGES.map((stage, index) => {
            const done = percent >= 100 || index < stageIndex;
            const active = percent < 100 && index === stageIndex;
            return (
              <li
                key={stage.key}
                data-stage-row
                className={cn(
                  "flex items-center gap-3 py-2.5 transition-colors duration-300",
                  active ? "text-ink" : done ? "text-ink-muted" : "text-ink-faint",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-pill border font-mono text-[11px]",
                    done
                      ? "border-success/45 bg-success/12 text-success"
                      : active
                        ? "border-primary-400/60 bg-primary-500/15 text-primary-200"
                        : "border-line text-ink-faint",
                  )}
                >
                  {done ? (
                    <IconCheck size={13} />
                  ) : active ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-300" />
                  ) : (
                    index + 1
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium">{stage.label}</span>
                  <span className="hidden truncate text-micro text-ink-faint sm:block">
                    {stage.description}
                  </span>
                </span>

                <span className="numeric shrink-0 text-micro text-ink-faint">{stage.progress}%</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <AnimatePresence>
        {percent >= 100 ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-t border-line px-6 py-3 text-small text-success"
          >
            Analysis complete — rendering your results…
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Ticking elapsed-seconds counter.
 *
 * Stops updating once the run finishes so the last rendered value is the real
 * duration rather than a timer that keeps climbing.
 */
function useElapsedSeconds(startedAt: number | null, finished: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const update = () => setElapsed((Date.now() - startedAt) / 1000);
    update();

    if (finished) return;
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [startedAt, finished]);

  return elapsed;
}
