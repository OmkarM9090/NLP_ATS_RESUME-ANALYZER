"use client";

import { motion } from "framer-motion";

import { SCORE_DIMENSIONS } from "@/lib/constants";
import { barWidth, formatScore, scoreColor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ScoreBreakdown as ScoreBreakdownType } from "@/types";

interface Props {
  breakdown: ScoreBreakdownType;
  overall: number;
  className?: string;
}

/**
 * The five weighted dimensions as horizontal bars.
 *
 * Each row shows the raw score, the configured weight and the weighted
 * contribution, plus the backend's own `detail` string so the number is
 * explainable rather than opaque.
 */
export function ScoreBreakdown({ breakdown, overall, className }: Props) {
  const rows = SCORE_DIMENSIONS.map((dim) => {
    const component = breakdown[dim.key];
    return {
      key: dim.key,
      label: dim.label,
      shortLabel: dim.shortLabel,
      description: dim.description,
      score: component?.score ?? 0,
      weight: component?.weight ?? 0,
      weighted: component?.weighted_score ?? 0,
      detail: component?.detail ?? "",
    };
  });

  const weightedTotal = rows.reduce((sum, row) => sum + row.weighted, 0);

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="label">Weighted contribution</p>
          <p className="numeric text-h4 text-ink">
            {formatScore(weightedTotal)}
            <span className="ml-2 text-small text-ink-faint">sums to the overall score</span>
          </p>
        </div>
        <p className="numeric text-small text-ink-muted">
          overall {formatScore(overall)} / 100
        </p>
      </div>

      <ul className="space-y-4">
        {rows.map((row, index) => (
          <motion.li
            key={row.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 * index, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-body font-medium text-ink">{row.label}</p>
                <p className="text-micro text-ink-faint">{row.description}</p>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="numeric text-micro text-ink-faint">
                  weight {(row.weight * 100).toFixed(0)}%
                </span>
                <span
                  className="numeric text-h5 font-semibold tabular-nums"
                  style={{ color: scoreColor(row.score) }}
                >
                  {formatScore(row.score)}
                </span>
                <span className="numeric w-14 text-right text-small text-ink-muted">
                  +{row.weighted.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-raised">
              <motion.div
                className="h-full rounded-pill"
                style={{ backgroundColor: scoreColor(row.score) }}
                initial={{ width: 0 }}
                animate={{ width: barWidth(row.score) }}
                transition={{ duration: 0.85, delay: 0.08 * index, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            {row.detail ? (
              <p className="text-small leading-relaxed text-ink-muted">{row.detail}</p>
            ) : null}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
