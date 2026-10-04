"use client";

import { useEffect, useRef } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Flame,
  Info,
  KeyRound,
  Puzzle,
  Section,
  Zap,
} from "lucide-react";
import type { GapAnalysis, Recommendation } from "@/types/analysis";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { gsap, revealOnScroll } from "@/lib/anim";

/* ------------------------------ Gaps -------------------------------- */

export function GapsPanel({ gaps }: { gaps: GapAnalysis }) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-gap-block]"), {
        trigger: el,
        y: 18,
        stagger: 0.07,
        start: "top 86%",
      });
    }, el);
    return () => ctx.revert();
  }, [gaps]);

  return (
    <div ref={scope} className="card flex h-full flex-col rounded-2xl p-6 sm:p-7">
      <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em]">Gap analysis</h3>
      <p className="mt-1 text-[12.5px] text-faint">Exactly what&apos;s costing you points on this role.</p>

      <div className="mt-5 flex-1 space-y-6">
        {gaps.missing_keywords.length > 0 && (
          <div data-gap-block>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
              <KeyRound className="h-3.5 w-3.5" /> Missing JD keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.missing_keywords.map((k) => (
                <span
                  key={k.keyword}
                  className="rounded-md border border-danger/25 bg-danger/[0.08] px-2 py-1 font-mono text-[11px] text-red-300"
                  title={`Appears ${k.occurrences}× in the job description`}
                >
                  {k.keyword}
                  <span className="ml-1.5 text-red-400/60">×{k.occurrences}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {gaps.missing_skills.length > 0 && (
          <div data-gap-block>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
              <Puzzle className="h-3.5 w-3.5" /> Missing skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.missing_skills.map((s) => (
                <span
                  key={s.skill}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-[11px]",
                    s.importance === "high"
                      ? "border-danger/25 bg-danger/[0.08] text-red-300"
                      : "border-warning/25 bg-warning/[0.08] text-amber-300",
                  )}
                >
                  {s.skill}
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {s.importance === "high" ? "req" : s.importance === "low" ? "pref" : "core"}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {gaps.weak_sections.length > 0 && (
          <div data-gap-block>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
              <Section className="h-3.5 w-3.5" /> Weak sections
            </p>
            <div className="space-y-2">
              {gaps.weak_sections.map((w) => (
                <div key={w.section} className="rounded-lg border border-warning/20 bg-warning/[0.05] px-3 py-2.5">
                  <p className="flex items-center justify-between text-[13.5px]">
                    <span className="font-medium capitalize text-ink">{w.section}</span>
                    <span className="font-mono text-xs text-warning">{w.score}/100</span>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-mist">{w.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(gaps.experience_gap || gaps.education_gap) && (
          <div className="space-y-2.5" data-gap-block>
            {gaps.experience_gap && (
              <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12.5px] leading-relaxed text-mist">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {gaps.experience_gap}
              </div>
            )}
            {gaps.education_gap && (
              <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12.5px] leading-relaxed text-mist">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                {gaps.education_gap}
              </div>
            )}
          </div>
        )}

        {!gaps.missing_keywords.length &&
          !gaps.missing_skills.length &&
          !gaps.weak_sections.length && (
            <p className="text-[13px] leading-relaxed text-mist">
              No significant gaps detected — your resume covers the posting&apos;s
              keywords, skills, and sections well. Polish and apply with confidence.
            </p>
          )}
      </div>
    </div>
  );
}

/* ------------------------- Recommendations -------------------------- */

const PRI_STYLE: Record<
  Recommendation["priority"],
  { icon: typeof Flame; chip: string; border: string; label: string }
> = {
  high: {
    icon: Flame,
    chip: "bg-danger/15 text-red-300 border-danger/30",
    border: "border-l-danger",
    label: "high priority",
  },
  medium: {
    icon: Zap,
    chip: "bg-warning/15 text-amber-300 border-warning/30",
    border: "border-l-warning",
    label: "medium",
  },
  low: {
    icon: Info,
    chip: "bg-secondary/15 text-cyan-300 border-secondary/30",
    border: "border-l-secondary",
    label: "low",
  },
};

export function RecommendationsPanel({ recs }: { recs: Recommendation[] }) {
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-rec]"), {
        trigger: el,
        y: 20,
        stagger: 0.06,
        start: "top 86%",
      });
    }, el);
    return () => ctx.revert();
  }, [recs]);

  return (
    <div ref={scope} className="card flex h-full flex-col rounded-2xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em]">Recommendations</h3>
          <p className="mt-1 text-[12.5px] text-faint">
            Prioritized, specific fixes — highest impact first.
          </p>
        </div>
        <Badge tone="primary">{recs.length} actions</Badge>
      </div>

      <div className="mt-5 flex-1 space-y-3.5">
        {recs.map((r, i) => {
          const P = PRI_STYLE[r.priority];
          return (
            <div
              key={i}
              data-rec
              className={cn(
                "rounded-xl border border-white/[0.06] border-l-2 bg-white/[0.02] p-4 transition-colors duration-300 hover:border-white/[0.12]",
                P.border,
              )}
            >
              <div className="flex items-center gap-2">
                <P.icon className="h-3.5 w-3.5 text-mist" />
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", P.chip)}>
                  {P.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-mist/60">
                  {r.category}
                </span>
              </div>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink/90">{r.message}</p>
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-mist">
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                {r.action}
              </p>
            </div>
          );
        })}
        {!recs.length && (
          <p className="text-[13px] text-mist">
            No recommendations — this pairing is already well aligned.
          </p>
        )}
      </div>
    </div>
  );
}
