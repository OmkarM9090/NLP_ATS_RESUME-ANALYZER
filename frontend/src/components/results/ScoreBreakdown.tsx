"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import type { ScoreBreakdown as SB } from "@/types/analysis";
import { scoreColor } from "@/lib/utils";

const LABELS: Record<keyof SB, string> = {
  keyword_match: "Keyword match",
  semantic_similarity: "Semantic similarity",
  skill_match: "Skill match",
  experience_relevance: "Experience relevance",
  education_match: "Education match",
};

const ORDER: Array<keyof SB> = [
  "semantic_similarity",
  "keyword_match",
  "skill_match",
  "experience_relevance",
  "education_match",
];

export default function ScoreBreakdown({
  breakdown,
  keywordDensity,
}: {
  breakdown: SB;
  keywordDensity: { resume: number; jd: number };
}) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const rows = el.querySelectorAll("[data-sb-row]");
      const fills = el.querySelectorAll("[data-sb-fill]");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        gsap.set(rows, { opacity: 1, y: 0 });
        gsap.set(fills, { scaleX: 1 });
        return;
      }

      gsap.set(rows, { opacity: 0, y: 16 });
      gsap.set(fills, { scaleX: 0 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        defaults: { ease: "power3.out" },
      });

      tl.to(rows, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07 }).to(
        fills,
        { scaleX: 1, duration: 1.1, stagger: 0.07 },
        0.15,
      );
    }, el);

    return () => ctx.revert();
  }, [breakdown]);

  return (
    <div ref={scope} className="card h-full rounded-2xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
            Score breakdown
          </h3>
          <p className="mt-1 text-[12.5px] text-faint">
            Five weighted signals fuse into the overall score.
          </p>
        </div>
        <span className="chip">weighted</span>
      </div>

      <div className="mt-6 space-y-5">
        {ORDER.map((key) => {
          const comp = breakdown[key];
          const color = scoreColor(comp.score);
          return (
            <div key={key} data-sb-row>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] text-ink/90">{LABELS[key]}</span>
                <span className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[10px] text-faint">
                    w {comp.weight.toFixed(2)}
                  </span>
                  <span
                    className="w-9 text-right font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {comp.score.toFixed(1)}
                  </span>
                </span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-tint-3">
                <span
                  data-sb-fill
                  className="block h-full origin-left rounded-full"
                  style={{
                    width: `${Math.max(2, comp.score)}%`,
                    background: `linear-gradient(90deg, ${color}99, ${color})`,
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-7 border-t border-line-soft pt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
          domain keyword density
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "resume", value: keywordDensity.resume },
            { label: "job post", value: keywordDensity.jd },
          ].map((d) => (
            <div
              key={d.label}
              className="rounded-xl border border-line-soft bg-void/40 px-3.5 py-3"
            >
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                {d.label}
              </p>
              <p className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-ink">
                {(d.value * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
