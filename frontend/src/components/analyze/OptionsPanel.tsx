"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { SCORE_DIMENSIONS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { IconChevron } from "@/components/ui/Icons";
import type { ScoreDimension } from "@/types";

export interface AnalysisOptions {
  weights: Record<ScoreDimension, number>;
  topKeywords: number;
  includeSectionText: boolean;
  persist: boolean;
}

export const DEFAULT_WEIGHTS: Record<ScoreDimension, number> = {
  keyword_match: 0.25,
  semantic_similarity: 0.3,
  skill_match: 0.25,
  experience_relevance: 0.1,
  education_match: 0.1,
};

export const DEFAULT_OPTIONS: AnalysisOptions = {
  weights: DEFAULT_WEIGHTS,
  topKeywords: 30,
  includeSectionText: false,
  persist: true,
};

interface OptionsPanelProps {
  options: AnalysisOptions;
  onChange: (options: AnalysisOptions) => void;
  disabled?: boolean;
}

/**
 * Collapsible "advanced" panel: score-weight overrides, keyword count and
 * storage toggles.
 *
 * Weights are edited as percentages and renormalised live so the displayed total
 * always reads 100% — the backend renormalises too, but showing the effective
 * split keeps the numbers trustworthy.
 */
export function OptionsPanel({ options, onChange, disabled = false }: OptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const groupId = useId();

  const total = SCORE_DIMENSIONS.reduce((sum, dim) => sum + (options.weights[dim.key] ?? 0), 0);
  const normalised = (value: number) => (total > 0 ? value / total : 0);

  const setWeight = (key: ScoreDimension, value: number) => {
    onChange({ ...options, weights: { ...options.weights, [key]: value } });
  };

  return (
    <div className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`${groupId}-panel`}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-raised/60"
      >
        <span>
          <span className="block text-body font-semibold text-ink">Scoring options</span>
          <span className="block text-small text-ink-muted">
            Weight overrides, keyword depth and history storage
          </span>
        </span>
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-pill border border-line text-ink-muted transition-transform duration-300",
            open && "rotate-180 border-primary-400/45 text-primary-200",
          )}
        >
          <IconChevron size={16} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`${groupId}-panel`}
            key="options"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-6 border-t border-line px-5 py-5">
              <fieldset disabled={disabled} className="space-y-4">
                <legend className="mb-3 flex w-full items-baseline justify-between gap-3">
                  <span className="label">Score weights</span>
                  <span className="numeric text-micro text-ink-faint">
                    raw {total.toFixed(2)} · effective 100%
                  </span>
                </legend>

                {SCORE_DIMENSIONS.map((dim) => {
                  const raw = options.weights[dim.key] ?? 0;
                  const effective = normalised(raw);
                  return (
                    <div key={dim.key} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <label
                          htmlFor={`${groupId}-${dim.key}`}
                          className="text-small font-medium text-ink"
                        >
                          {dim.label}
                        </label>
                        <span className="numeric text-micro text-ink-muted">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(raw * 100)}
                            disabled={disabled}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              if (Number.isFinite(next)) {
                                setWeight(dim.key, Math.max(0, Math.min(100, next)) / 100);
                              }
                            }}
                            className="numeric w-16 rounded-button border border-line bg-surface-raised px-2 py-1 text-right text-micro text-ink focus:border-primary-400/60 focus:outline-none"
                            aria-label={`${dim.label} weight percent`}
                          />
                          <span className="ml-1 text-ink-faint">
                            → {(effective * 100).toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <input
                        id={`${groupId}-${dim.key}`}
                        type="range"
                        min={0}
                        max={0.6}
                        step={0.01}
                        value={raw}
                        disabled={disabled}
                        onChange={(event) => setWeight(dim.key, Number(event.target.value))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-surface-raised accent-primary-500"
                      />
                      <p className="text-micro text-ink-faint">{dim.description}</p>
                    </div>
                  );
                })}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ...options, weights: DEFAULT_WEIGHTS })}
                    className="rounded-button border border-line px-3 py-1.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-muted transition-colors hover:border-primary-400/50 hover:text-ink disabled:opacity-50"
                  >
                    Reset weights
                  </button>
                  {total === 0 ? (
                    <span className="text-micro text-warning">
                      All weights are zero — the backend will score every dimension equally.
                    </span>
                  ) : null}
                </div>
              </fieldset>

              <div className="hairline" />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={`${groupId}-keywords`} className="text-small font-medium text-ink">
                    Top keywords
                    <span className="ml-2 text-micro text-ink-faint">5–60</span>
                  </label>
                  <input
                    id={`${groupId}-keywords`}
                    type="number"
                    min={5}
                    max={60}
                    step={1}
                    value={options.topKeywords}
                    disabled={disabled}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        onChange({
                          ...options,
                          topKeywords: Math.max(5, Math.min(60, Math.round(next))),
                        });
                      }
                    }}
                    className="numeric w-20 rounded-button border border-line bg-surface-raised px-2.5 py-1.5 text-right text-small text-ink focus:border-primary-400/60 focus:outline-none"
                  />
                </div>

                <Toggle
                  id={`${groupId}-persist`}
                  label="Save to history"
                  description="Store this analysis in the local SQLite database so you can reopen it later."
                  checked={options.persist}
                  disabled={disabled}
                  onChange={(checked) => onChange({ ...options, persist: checked })}
                />

                <Toggle
                  id={`${groupId}-sections`}
                  label="Include section text"
                  description="Return the raw text of every parsed section (larger response, richer export)."
                  checked={options.includeSectionText}
                  disabled={disabled}
                  onChange={(checked) => onChange({ ...options, includeSectionText: checked })}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-button border border-transparent px-2 py-2 transition-colors hover:border-line hover:bg-surface-raised/50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-small font-medium text-ink">{label}</span>
        <span className="block text-micro leading-relaxed text-ink-faint">{description}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          className={cn(
            "block h-6 w-11 rounded-pill border transition-colors duration-200",
            checked ? "border-primary-400/60 bg-primary-500/70" : "border-line bg-surface-raised",
          )}
        />
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-ink transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </label>
  );
}
