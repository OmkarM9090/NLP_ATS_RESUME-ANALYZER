"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { gradeHex, gradeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Grade } from "@/types";

export interface ScoreGaugeProps {
  score: number;
  grade: Grade;
  verdict?: string;
  /** Diameter in px (defaults to 280 desktop / 220 mobile). */
  size?: number;
  className?: string;
}

const SWEEP = 270; // degrees of arc used by the gauge
const START = 135; // rotate so the gap sits at the bottom

/**
 * Radial score gauge.
 *
 * Pure SVG (no chart dependency): a track arc, a coloured value arc drawn with
 * stroke-dasharray, a grade badge in the middle and the verdict underneath. The
 * arc animates from 0 with rAF and respects prefers-reduced-motion.
 */
export function ScoreGauge({ score, grade, verdict, size = 280, className }: ScoreGaugeProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [animated, setAnimated] = useState(reducedMotion ? score : 0);
  const [display, setDisplay] = useState(reducedMotion ? score : 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setAnimated(score);
      setDisplay(score);
      return;
    }

    const duration = 1500;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo — matches the site's GSAP easing vocabulary.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const value = from + (score - from) * eased;
      setAnimated(value);
      setDisplay(value);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [score, reducedMotion]);

  const radius = (size - 28) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (SWEEP / 360) * circumference;
  const clamped = Math.max(0, Math.min(100, animated));
  const filled = (clamped / 100) * arcLength;
  const color = gradeHex(grade);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Overall match score ${score.toFixed(1)} out of 100, grade ${grade}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="gauge-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.75" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id="gauge-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`rotate(${START} ${size / 2} ${size / 2})`}>
            {/* Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1E293B"
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
            />
            {/* Ticks every 10 points */}
            {Array.from({ length: 11 }).map((_, index) => {
              const angle = (index / 10) * SWEEP;
              const radians = (angle * Math.PI) / 180;
              const inner = radius - 12;
              const outer = radius - 20;
              const cx = size / 2;
              const cy = size / 2;
              return (
                <line
                  key={index}
                  x1={cx + inner * Math.cos(radians)}
                  y1={cy + inner * Math.sin(radians)}
                  x2={cx + outer * Math.cos(radians)}
                  y2={cy + outer * Math.sin(radians)}
                  stroke={index * 10 <= clamped ? color : "#263248"}
                  strokeWidth={index % 5 === 0 ? 2.2 : 1.2}
                  strokeLinecap="round"
                  opacity={index * 10 <= clamped ? 0.85 : 0.5}
                />
              );
            })}
            {/* Value arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#gauge-fill)"
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              filter="url(#gauge-glow)"
            />
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="numeric text-[68px] leading-none font-semibold tabular-nums" style={{ color }}>
            {display.toFixed(1)}
          </p>
          <p className="mt-1 font-mono text-micro uppercase tracking-[0.22em] text-ink-faint">
            out of 100
          </p>
          <span
            className="mt-4 inline-flex items-center gap-2 rounded-pill border px-3 py-1"
            style={{ borderColor: `${color}55`, backgroundColor: `${color}14` }}
          >
            <span className="font-heading text-h5" style={{ color }}>
              {grade}
            </span>
            <span className="font-mono text-micro uppercase tracking-[0.14em]" style={{ color }}>
              {gradeLabel(grade)}
            </span>
          </span>
        </div>
      </div>

      {verdict ? (
        <p className="max-w-md text-center text-body leading-relaxed text-ink-muted">{verdict}</p>
      ) : null}
    </div>
  );
}
