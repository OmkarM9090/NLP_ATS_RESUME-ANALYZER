"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap-config";

/* The real pipeline stages, in execution order (backend/core/*). */
const STAGES = [
  "PDF extraction",
  "Text normalisation",
  "Tokenization",
  "Protected terms",
  "Stop-word removal",
  "Lemmatisation",
  "POS tagging",
  "Entity extraction",
  "Section parsing",
  "TF-IDF ranking",
  "RAKE keywords",
  "Skill taxonomy",
  "Semantic vectors",
  "Weighted fusion",
  "ATS formatting audit",
];

export default function PipelineTicker() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion()) return;

    const tween = gsap.to(track, {
      xPercent: -50,
      duration: 42,
      ease: "none",
      repeat: -1,
    });

    // Scroll velocity nudges the marquee speed — a small, satisfying detail.
    let last = window.scrollY;
    let boost = 0;
    let raf = 0;

    const onScroll = () => {
      const dy = Math.abs(window.scrollY - last);
      last = window.scrollY;
      boost = Math.min(boost + dy / 60, 3.2);
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      boost *= 0.94;
      tween.timeScale(1 + boost);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      tween.kill();
    };
  }, []);

  const row = [...STAGES, ...STAGES];

  return (
    <section
      aria-label="NLP pipeline stages"
      className="relative border-y border-line-soft bg-abyss/60 py-7"
    >
      <div className="mx-auto mb-5 flex max-w-7xl items-center gap-4 px-5 sm:px-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-faint">
          inside the engine
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-line-strong to-transparent" />
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-secondary/80 sm:block">
          deterministic · inspectable
        </span>
      </div>

      <div className="mask-fade-x relative overflow-hidden">
        <div ref={trackRef} className="flex w-max items-center pr-10">
          {row.map((stage, i) => (
            <div
              key={`${stage}-${i}`}
              aria-hidden={i >= STAGES.length}
              className="group flex items-center gap-3 px-5"
            >
              <span className="font-mono text-[10px] tabular-nums text-faint">
                {String((i % STAGES.length) + 1).padStart(2, "0")}
              </span>
              <span className="whitespace-nowrap font-display text-[15px] font-medium tracking-[-0.01em] text-mist transition-colors duration-300 group-hover:text-ink">
                {stage}
              </span>
              <span className="h-1 w-1 rounded-full bg-tint-4" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
