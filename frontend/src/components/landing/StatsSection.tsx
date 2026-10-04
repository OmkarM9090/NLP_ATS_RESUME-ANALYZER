"use client";

import { useEffect, useRef } from "react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { revealOnScroll, gsap } from "@/lib/anim";

const STATS = [
  {
    value: 80.2,
    decimals: 1,
    suffix: "",
    label: "Sample match score",
    detail: "ML resume × ML job description",
  },
  {
    value: 5,
    suffix: "",
    label: "Weighted signals",
    detail: "keyword · semantic · skills · experience · education",
  },
  {
    value: 13,
    suffix: "",
    label: "ATS format checks",
    detail: "run against every uploaded resume",
  },
  {
    value: 1,
    decimals: 1,
    prefix: "~",
    suffix: "s",
    label: "End-to-end runtime",
    detail: "CPU only, no external API calls",
  },
];

export default function StatsSection() {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-stat]"), {
        trigger: el,
        y: 30,
        stagger: 0.09,
        start: "top 84%",
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={scope}
      className="relative border-y border-line-soft bg-abyss/50 py-20 sm:py-24"
    >
      <div className="pointer-events-none absolute inset-0 ambient-bottom" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-faint">
            measured, not marketed
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
        </div>

        <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} data-stat className="relative">
              <p className="stat-value text-[clamp(2.4rem,4vw,3.25rem)] leading-none text-ink">
                <AnimatedCounter
                  value={s.value}
                  decimals={s.decimals ?? 0}
                  prefix={s.prefix ?? ""}
                  suffix={s.suffix ?? ""}
                  startOnView
                />
              </p>
              <p className="mt-3.5 font-display text-[15px] font-medium tracking-[-0.01em] text-ink/90">
                {s.label}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
