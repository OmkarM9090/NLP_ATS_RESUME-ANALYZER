"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { scoreColor, scoreGradient, scoreLabel } from "@/lib/utils";

/**
 * The headline number. The arc draws with DrawSVG-style dash offset while the
 * value counts up, both driven by GSAP for a single, synced motion.
 */
export default function ScoreGauge({ score }: { score: number }) {
  const uid = useId().replace(/[:]/g, "");
  const gid = `gauge-${uid}`;
  const [c1, c2] = scoreGradient(score);
  const color = scoreColor(score);
  const scope = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  const R = 82;
  const CIRC = 2 * Math.PI * R;

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const arc = el.querySelector<SVGCircleElement>(".gauge-arc");
      const caption = el.querySelector(".gauge-caption");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.set(arc, { strokeDasharray: CIRC, strokeDashoffset: CIRC });
      gsap.set(caption, { opacity: 0 });

      if (reduced) {
        gsap.set(arc, { strokeDashoffset: CIRC * (1 - score / 100) });
        gsap.set(caption, { opacity: 1 });
        if (valueRef.current) valueRef.current.textContent = score.toFixed(1);
        return;
      }

      const state = { v: 0 };
      gsap
        .timeline({ delay: 0.35 })
        .to(arc, {
          strokeDashoffset: CIRC * (1 - score / 100),
          duration: 1.9,
          ease: "power3.out",
        })
        .to(
          state,
          {
            v: score,
            duration: 1.9,
            ease: "power2.out",
            onUpdate: () => {
              if (valueRef.current) valueRef.current.textContent = state.v.toFixed(1);
            },
          },
          0,
        )
        .fromTo(
          el.querySelector(".gauge-glow"),
          { opacity: 0, scale: 0.8 },
          { opacity: 0.4, scale: 1, duration: 1.4 },
          0.4,
        )
        .fromTo(
          el.querySelector(".gauge-caption"),
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          1.1,
        );
    }, el);

    return () => ctx.revert();
  }, [score, CIRC]);

  return (
    <div ref={scope} className="relative flex flex-col items-center">
      <div
        className="gauge-glow pointer-events-none absolute top-[42%] h-52 w-52 -translate-y-1/2 rounded-full opacity-0 blur-[80px]"
        style={{ background: color }}
      />

      <div className="relative h-[208px] w-[208px]">
        <svg viewBox="0 0 208 208" className="h-full w-full -rotate-90">
          <circle
            cx="104"
            cy="104"
            r={R}
            fill="none"
            className="stroke-track"
            strokeWidth="10"
          />
          <circle
            className="gauge-arc"
            cx="104"
            cy="104"
            r={R}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            ref={valueRef}
            className="font-mono text-[46px] font-bold leading-none tracking-[-0.05em] tabular-nums"
            style={{ color }}
          >
            0.0
          </span>
          <span className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.26em] text-faint">
            / 100 match
          </span>
        </div>
      </div>

      <div className="gauge-caption mt-5 flex flex-col items-center">
        <span
          className="rounded-full px-3 py-1 font-display text-[13px] font-semibold"
          style={{ color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33` }}
        >
          {scoreLabel(score)}
        </span>
        <p className="mt-3 max-w-[230px] text-center text-[11.5px] leading-relaxed text-faint">
          Weighted across keyword, semantic, skill, experience and education
          signals
        </p>
      </div>
    </div>
  );
}
