"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { IconChevron } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { formatScore, scoreColor, sectionLabel } from "@/lib/format";
import type { SectionInfo, SectionScore } from "@/types";

interface Props {
  sectionScores: Record<string, SectionScore>;
  sections?: Record<string, SectionInfo>;
  className?: string;
}

/**
 * Per-section scoring accordion.
 *
 * Rows are ordered by score (weakest first) because that is the actionable
 * ordering; expanding a row reveals the backend's feedback, similarity,
 * suggestions and — when `include_section_text` was requested — the raw text.
 */
export function SectionAccordion({ sectionScores, sections, className }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const entries = Object.entries(sectionScores ?? {})
    .map(([name, score]) => ({ name, score, info: sections?.[name] }))
    .sort((a, b) => {
      // Present sections first, then weakest first.
      if (a.score.present !== b.score.present) return a.score.present ? -1 : 1;
      return a.score.score - b.score.score;
    });

  const average = entries.length
    ? entries.reduce((sum, entry) => sum + entry.score.score, 0) / entries.length
    : 0;

  return (
    <Card className={cn("space-y-5", className)}>
      <CardHeader
        eyebrow="Structure"
        title="Section scores"
        description="Each detected section is compared against the matching part of the job description and scored for coverage and quality."
        action={
          <div className="text-right">
            <p className="numeric text-h3 text-ink">{formatScore(average)}</p>
            <p className="label">avg across {entries.length}</p>
          </div>
        }
      />

      {entries.length === 0 ? (
        <p className="text-small text-ink-faint">
          No sections could be detected in the resume — it may be a single block of unstructured text.
        </p>
      ) : (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-card border border-line">
          {entries.map(({ name, score, info }) => {
            const isOpen = open === name;
            const colour = scoreColor(score.score);
            return (
              <li key={name} className="bg-surface/40">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : name)}
                  aria-expanded={isOpen}
                  aria-controls={`section-panel-${name}`}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-raised/60"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border font-mono text-micro"
                    style={{ color: colour, borderColor: `${colour}55`, backgroundColor: `${colour}12` }}
                  >
                    {score.present ? score.score.toFixed(0) : "—"}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body font-medium text-ink">
                        {info?.heading || sectionLabel(name)}
                      </span>
                      {!score.present ? (
                        <span className="rounded-pill border border-line px-2 py-0.5 font-mono text-micro uppercase tracking-[0.1em] text-ink-faint">
                          not found
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block">
                      <ProgressBar
                        value={score.score}
                        size="xs"
                        colorClass=""
                        scoreColored
                        className="[&>div:first-child]:hidden"
                      />
                    </span>
                  </span>

                  <span className="numeric hidden shrink-0 text-micro text-ink-faint sm:block">
                    {info?.word_count ? `${info.word_count} words` : ""}
                  </span>

                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-line text-ink-muted transition-transform duration-300",
                      isOpen && "rotate-180 border-primary-400/45 text-primary-200",
                    )}
                  >
                    <IconChevron size={15} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      id={`section-panel-${name}`}
                      key="panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-line px-4 py-4">
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          <Stat label="Score" value={formatScore(score.score)} />
                          <Stat label="Similarity to JD" value={formatScore(score.similarity * 100, 0)} suffix="%" />
                          {info?.confidence !== undefined ? (
                            <Stat label="Detection confidence" value={formatScore(info.confidence * 100, 0)} suffix="%" />
                          ) : null}
                          {info?.line_count ? <Stat label="Lines" value={String(info.line_count)} /> : null}
                        </div>

                        {score.feedback ? (
                          <p className="text-small leading-relaxed text-ink-muted">{score.feedback}</p>
                        ) : null}

                        {score.suggestions?.length ? (
                          <ul className="space-y-1.5">
                            {score.suggestions.map((suggestion) => (
                              <li key={suggestion} className="flex items-start gap-2 text-small text-ink-muted">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary-400" />
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {info?.text ? (
                          <details className="rounded-button border border-line bg-bg-deep/50 p-3">
                            <summary className="cursor-pointer font-mono text-micro uppercase tracking-[0.14em] text-ink-faint">
                              Raw section text
                            </summary>
                            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-micro leading-relaxed text-ink-muted">
                              {info.text}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="numeric text-body text-ink">
        {value}
        {suffix}
      </p>
    </div>
  );
}
