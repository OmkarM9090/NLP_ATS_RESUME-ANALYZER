"use client";

import { cn } from "@/lib/cn";
import { barWidth, scoreColor } from "@/lib/format";

export interface ProgressBarProps {
  /** 0-100 (or 0-1 when `max` is 1). */
  value: number;
  max?: number;
  /** Fixed Tailwind colour class; overrides the score-derived colour. */
  colorClass?: string;
  /** Use the continuous score gradient instead of a flat colour. */
  scoreColored?: boolean;
  size?: "xs" | "sm" | "md";
  showValue?: boolean;
  label?: string;
  className?: string;
  /** Animate the fill on mount. */
  animated?: boolean;
}

const HEIGHTS = { xs: "h-1", sm: "h-1.5", md: "h-2.5" } as const;

/** Accessible horizontal meter used by score breakdowns and the loader. */
export function ProgressBar({
  value,
  max = 100,
  colorClass,
  scoreColored = false,
  size = "sm",
  showValue = false,
  label,
  className,
  animated = true,
}: ProgressBarProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const percent = ratio * 100;
  const inlineStyle = scoreColored ? { backgroundColor: scoreColor(percent) } : undefined;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-3">
          {label ? <span className="label truncate">{label}</span> : <span />}
          {showValue ? (
            <span className="numeric text-micro text-ink-muted">{percent.toFixed(0)}%</span>
          ) : null}
        </div>
      )}
      <div
        className={cn("w-full overflow-hidden rounded-pill bg-surface-raised", HEIGHTS[size])}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "progress"}
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-700 ease-expo",
            colorClass ?? "bg-gradient-to-r from-primary-500 to-secondary-400",
            animated && "motion-reduce:transition-none",
          )}
          style={{ width: barWidth(percent), ...inlineStyle }}
        />
      </div>
    </div>
  );
}

/** Thin indeterminate bar used while a request is in flight. */
export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-0.5 w-full overflow-hidden rounded-pill bg-surface-raised", className)}>
      <div className="absolute inset-y-0 left-0 w-1/3 animate-[marquee_1.4s_ease-in-out_infinite_alternate] rounded-pill bg-gradient-to-r from-primary-500 via-secondary-400 to-primary-400" />
    </div>
  );
}
