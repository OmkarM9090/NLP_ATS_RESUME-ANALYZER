"use client";

import { motion } from "framer-motion";
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

/* ------------------------------ Gaps -------------------------------- */

export function GapsPanel({ gaps }: { gaps: GapAnalysis }) {
  return (
    <div className="glass flex h-full flex-col rounded-2xl p-6 sm:p-7">
      <h3 className="font-display text-base font-semibold">Gap analysis</h3>
      <p className="mt-1 text-xs text-mist">Exactly what's costing you points on this role.</p>

      <div className="mt-5 flex-1 space-y-6">
        {gaps.missing_keywords.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
              <KeyRound className="h-3.5 w-3.5" /> Missing JD keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.missing_keywords.map((k) => (
                <span
                  key={k.keyword}
                  className="rounded-md border border-danger/25 bg-danger/[0.08] px-2 py-1 font-mono text-xs text-red-300"
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
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
              <Puzzle className="h-3.5 w-3.5" /> Missing skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gaps.missing_skills.map((s) => (
                <span
                  key={s.skill}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-xs",
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
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
              <Section className="h-3.5 w-3.5" /> Weak sections
            </p>
            <div className="space-y-2">
              {gaps.weak_sections.map((w) => (
                <div key={w.section} className="rounded-lg border border-warning/20 bg-warning/[0.05] px-3 py-2.5">
                  <p className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize text-ink">{w.section}</span>
                    <span className="font-mono text-xs text-warning">{w.score}/100</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-mist">{w.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(gaps.experience_gap || gaps.education_gap) && (
          <div className="space-y-2.5">
            {gaps.experience_gap && (
              <div className="flex items-start gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 text-xs leading-relaxed text-mist">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {gaps.experience_gap}
              </div>
            )}
            {gaps.education_gap && (
              <div className="flex items-start gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2.5 text-xs leading-relaxed text-mist">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                {gaps.education_gap}
              </div>
            )}
          </div>
        )}

        {!gaps.missing_keywords.length &&
          !gaps.missing_skills.length &&
          !gaps.weak_sections.length && (
            <p className="text-sm leading-relaxed text-mist">
              No significant gaps detected — your resume covers the JD's
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
  return (
    <div className="glass flex h-full flex-col rounded-2xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Recommendations</h3>
          <p className="mt-1 text-xs text-mist">
            Prioritized, specific fixes — highest impact first.
          </p>
        </div>
        <Badge tone="primary">{recs.length} actions</Badge>
      </div>

      <div className="mt-5 flex-1 space-y-3.5">
        {recs.map((r, i) => {
          const P = PRI_STYLE[r.priority];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "rounded-xl border border-line border-l-4 bg-white/[0.02] p-4",
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
              <p className="mt-2.5 text-sm leading-relaxed text-ink/90">{r.message}</p>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-mist">
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                {r.action}
              </p>
            </motion.div>
          );
        })}
        {!recs.length && (
          <p className="text-sm text-mist">
            No recommendations — this pairing is already well aligned.
          </p>
        )}
      </div>
    </div>
  );
}
