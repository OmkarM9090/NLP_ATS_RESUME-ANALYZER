"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { priorityTokens } from "@/lib/constants";
import { categoryLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Priority, Recommendation } from "@/types";

type PriorityFilter = "all" | Priority;

const FILTERS: Array<{ key: PriorityFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Prioritised recommendations.
 *
 * The backend already sorts by priority then impact; the UI keeps that order,
 * adds a filter, and shows the 0–100 impact score as a bar so "which fix moves
 * the score most" is glanceable.
 */
export function Recommendations({ items, className }: { items: Recommendation[]; className?: string }) {
  const [filter, setFilter] = useState<PriorityFilter>("all");
  const [done, setDone] = useState<Set<number>>(new Set());

  const sorted = useMemo(
    () =>
      [...(items ?? [])].sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
          (b.impact_score ?? 0) - (a.impact_score ?? 0),
      ),
    [items],
  );

  const visible = sorted.filter((entry) => filter === "all" || entry.priority === filter);
  const counts = sorted.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.priority] = (accumulator[entry.priority] ?? 0) + 1;
    return accumulator;
  }, {});

  const toggle = (index: number) =>
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <Card className={cn("space-y-6", className)}>
      <CardHeader
        eyebrow="Next steps"
        title="Recommendations"
        description="Ordered by priority, then by how much each fix is expected to move your score. Tick them off as you edit."
        action={
          <div className="text-right">
            <p className="numeric text-h3 text-ink">{sorted.length}</p>
            <p className="label">
              {done.size > 0 ? `${done.size} done` : "suggestions"}
            </p>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((entry) => {
          const active = filter === entry.key;
          const count = entry.key === "all" ? sorted.length : (counts[entry.key] ?? 0);
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              disabled={count === 0 && entry.key !== "all"}
              className={cn(
                "rounded-pill border px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] transition-colors disabled:opacity-40",
                active
                  ? "border-primary-400/60 bg-primary-500/14 text-primary-200"
                  : "border-line text-ink-faint hover:border-line-strong hover:text-ink-muted",
              )}
              aria-pressed={active}
            >
              {entry.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-small text-ink-faint">Nothing in this priority band.</p>
      ) : (
        <ol className="space-y-3">
          {visible.map((entry) => {
            const index = sorted.indexOf(entry);
            const tokens = priorityTokens(entry.priority);
            const isDone = done.has(index);
            return (
              <motion.li
                key={`${entry.category}-${index}`}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "rounded-card border p-4 transition-opacity sm:p-5",
                  tokens.border,
                  isDone && "opacity-55",
                )}
                style={{ backgroundColor: "rgba(18,18,26,0.55)" }}
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    aria-pressed={isDone}
                    aria-label={isDone ? `Mark "${entry.action}" as not done` : `Mark "${entry.action}" as done`}
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill border transition-colors",
                      isDone
                        ? "border-success/50 bg-success/15 text-success"
                        : "border-line text-transparent hover:border-primary-400/50",
                    )}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4.5 12.5l5 5 10-11" />
                    </svg>
                  </button>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className={cn("font-mono text-micro uppercase tracking-[0.14em]", tokens.text)}>
                        {tokens.label}
                      </span>
                      <span className="text-micro text-ink-faint">·</span>
                      <span className="font-mono text-micro uppercase tracking-[0.12em] text-ink-faint">
                        {categoryLabel(entry.category)}
                      </span>
                      <span className="ml-auto numeric text-micro text-ink-faint">
                        impact {entry.impact_score ?? 0}/100
                      </span>
                    </div>

                    <p className={cn("text-body font-semibold text-ink", isDone && "line-through decoration-ink-faint")}>
                      {entry.action}
                    </p>
                    <p className="text-small leading-relaxed text-ink-muted">{entry.message}</p>

                    <ProgressBar
                      value={entry.impact_score ?? 0}
                      size="xs"
                      className="[&>div:first-child]:hidden"
                      colorClass={cn(
                        entry.priority === "high"
                          ? "bg-danger"
                          : entry.priority === "medium"
                            ? "bg-warning"
                            : "bg-secondary-400",
                      )}
                    />
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
