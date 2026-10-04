"use client";

import { useRef } from "react";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useCountUp } from "@/hooks/useCountUp";
import { MARQUEE_TERMS, STATS } from "@/lib/constants";

/**
 * Stats: counters that start when the band scrolls into view, above an infinite
 * terminology marquee.
 */
export function Stats() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      gsap.fromTo(
        "[data-stat]",
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: scopeRef.current, start: "top 82%", toggleActions: "play none none reverse" },
        },
      );
    },
    { scope: scopeRef, disabled: reducedMotion },
  );

  return (
    <section className="section relative overflow-hidden py-16 sm:py-20" aria-label="Pipeline statistics">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-surface/40 to-transparent" />

      <div className="section-inner">
        <div ref={scopeRef} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              sublabel={stat.sublabel}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>

      <Marquee />
    </section>
  );
}

function StatCard({
  value,
  suffix,
  label,
  sublabel,
  reducedMotion,
}: {
  value: number;
  suffix: string;
  label: string;
  sublabel: string;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { display } = useCountUp({
    to: value,
    duration: 1.7,
    trigger: ref,
    disabled: reducedMotion,
  });

  return (
    <div
      data-stat
      ref={ref}
      className="relative rounded-card border border-line bg-surface/60 p-6 backdrop-blur-sm"
    >
      <p className="numeric text-[42px] leading-none font-semibold text-ink sm:text-[52px]">
        {display}
        <span className="text-primary-300">{suffix}</span>
      </p>
      <p className="mt-3 text-body font-medium text-ink">{label}</p>
      <p className="mt-1 text-small text-ink-faint">{sublabel}</p>
      <span className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />
    </div>
  );
}

function Marquee() {
  const items = [...MARQUEE_TERMS, ...MARQUEE_TERMS];

  return (
    <div className="relative mt-14 border-y border-line bg-surface/40 py-4">
      <div className="mask-fade-x overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-10 motion-reduce:animate-none">
          {items.map((term, index) => (
            <span
              key={`${term}-${index}`}
              className="flex items-center gap-10 font-mono text-micro uppercase tracking-[0.24em] text-ink-faint"
            >
              {term}
              <span className="h-1 w-1 rounded-full bg-primary-500/60" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
