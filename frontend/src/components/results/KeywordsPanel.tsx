"use client";

import { useEffect, useRef } from "react";
import type { JDKeyword } from "@/types/analysis";
import { Badge } from "@/components/ui/primitives";
import { gsap, revealOnScroll } from "@/lib/anim";
import { cn } from "@/lib/utils";

export default function KeywordsPanel({ keywords }: { keywords: JDKeyword[] }) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-kw]"), {
        trigger: el,
        y: 14,
        stagger: 0.014,
        duration: 0.55,
        start: "top 86%",
      });
    }, el);
    return () => ctx.revert();
  }, [keywords]);

  if (!keywords.length) return null;

  const found = keywords.filter((k) => k.found_in_resume).length;
  const maxScore = Math.max(...keywords.map((k) => k.tfidf_score), 0.001);

  return (
    <div ref={scope} className="card rounded-2xl p-6 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
            Top JD keywords
          </h3>
          <p className="mt-1 text-[12.5px] text-faint">
            Ranked by TF-IDF and RAKE importance. Size reflects weight in the
            posting.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="success">{found} in resume</Badge>
          <Badge tone="danger">{keywords.length - found} missing</Badge>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 py-2">
        {keywords.map((k) => {
          const t = k.tfidf_score / maxScore;
          const size = 0.8 + t * 0.95;
          return (
            <span
              key={k.keyword}
              data-kw
              title={
                k.found_in_resume
                  ? `“${k.keyword}” is in your resume · weight ${k.tfidf_score.toFixed(2)}`
                  : `“${k.keyword}” is missing · weight ${k.tfidf_score.toFixed(2)}`
              }
              style={{ fontSize: `${size.toFixed(2)}rem`, opacity: 0.65 + t * 0.35 }}
              className={cn(
                "cursor-default rounded-lg border px-2.5 py-1 font-medium leading-tight transition-transform duration-300 hover:scale-105",
                k.found_in_resume
                  ? "border-success/25 bg-success/[0.07] text-success"
                  : "border-danger/25 bg-danger/[0.07] text-danger",
              )}
            >
              {k.keyword}
            </span>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 border-t border-line-soft pt-4">
        {[
          { c: "bg-success", label: "present in resume" },
          { c: "bg-danger", label: "missing" },
        ].map((l) => (
          <span
            key={l.label}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", l.c)} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
