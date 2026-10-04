"use client";

import { useId } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "@/lib/gsap-config";
import { scoreColor, scoreGradient, scoreLabel } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

export default function ScoreGauge({ score }: { score: number }) {
  const uid = useId().replace(/[:]/g, "");
  const gid = `gauge-${uid}`;
  const [c1, c2] = scoreGradient(score);
  const color = scoreColor(score);

  const R = 84;
  const CIRC = 2 * Math.PI * R; // ≈ 527.8
  const target = CIRC * (1 - score / 100);

  const scope = useGSAP<HTMLDivElement>(({ scope }) => {
    const circle = scope.current?.querySelector<SVGCircleElement>(".gauge-arc");
    if (!circle) return;
    gsap.fromTo(
      circle,
      { strokeDashoffset: CIRC },
      { strokeDashoffset: target, duration: 2, ease: "power3.out", delay: 0.3 },
    );
    gsap.fromTo(
      scope.current!.querySelector(".gauge-glow"),
      { opacity: 0 },
      { opacity: 0.55, duration: 1.6, delay: 0.6 },
    );
  }, [score]);

  return (
    <div ref={scope} className="relative flex flex-col items-center">
      <div
        className="gauge-glow absolute top-1/2 h-56 w-56 -translate-y-1/2 rounded-full blur-[70px]"
        style={{ background: color }}
      />
      <div className="relative h-[220px] w-[220px]">
        <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
          <circle cx="110" cy="110" r={R} fill="none" stroke="#1E293B" strokeWidth="12" />
          <circle
            className="gauge-arc"
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC}
          />
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-6xl font-bold tracking-tighter" style={{ color }}>
            <AnimatedCounter value={score} decimals={1} startOnView={false} duration={2.1} format={false} />
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-mist">
            / 100 match
          </p>
        </div>
      </div>
      <p className="mt-4 font-display text-lg font-semibold" style={{ color }}>
        {scoreLabel(score)}
      </p>
      <p className="mt-1 max-w-[220px] text-center text-xs leading-relaxed text-mist">
        Weighted across keyword, semantic, skill, experience &amp; education signals
      </p>
    </div>
  );
}
