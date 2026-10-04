"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ATSFormatting, ATSIssue, SectionScores } from "@/types/analysis";
import { cn, scoreColor } from "@/lib/utils";

/* ------------------------- Section accordion ------------------------ */

export function SectionAccordion({ sections }: { sections: SectionScores }) {
  const entries = Object.entries(sections);
  const [open, setOpen] = useState<string | null>(entries[0]?.[0] ?? null);

  if (!entries.length) {
    return (
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-base font-semibold">Resume sections</h3>
        <p className="mt-2 text-xs leading-relaxed text-mist">
          No standard section headers were detected in this resume. Add labeled
          sections (Summary, Experience, Education, Skills) so ATS parsers can
          segment it — this also feeds the section-scoring below.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 sm:p-7">
      <h3 className="font-display text-base font-semibold">Section-by-section fit</h3>
      <p className="mt-1 text-xs text-mist">
        Semantic overlap of each resume section with the full job description.
      </p>

      <div className="mt-5 space-y-3">
        {entries.map(([name, s]) => {
          const color = scoreColor(s.score);
          const isOpen = open === name;
          return (
            <div
              key={name}
              className={cn(
                "overflow-hidden rounded-xl border transition-colors duration-300",
                isOpen ? "border-primary/30 bg-white/[0.03]" : "border-line bg-white/[0.015]",
              )}
            >
              <button
                onClick={() => setOpen(isOpen ? null : name)}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
              >
                <span className="w-24 shrink-0 font-display text-sm font-semibold capitalize">
                  {name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.score}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-sm font-semibold" style={{ color }}>
                  {s.score}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-mist transition-transform duration-300",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="border-t border-line/60 px-4 py-4">
                      <p className="text-sm leading-relaxed text-mist">{s.feedback}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/50">
                        raw cosine similarity {s.similarity.toFixed(2)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- ATS checklist -------------------------- */

const ISSUE_ICON: Record<ATSIssue["type"], typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const ISSUE_COLOR: Record<ATSIssue["type"], string> = {
  success: "text-success",
  info: "text-secondary",
  warning: "text-warning",
  error: "text-danger",
};

export function ATSChecklist({ ats }: { ats: ATSFormatting }) {
  const color = scoreColor(ats.score);
  return (
    <div className="glass rounded-2xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <ShieldCheck className="h-4.5 w-4.5 text-secondary" />
            ATS compatibility check
          </h3>
          <p className="mt-1 text-xs text-mist">
            Formatting heuristics that affect real-world ATS parsing.
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-3xl font-bold" style={{ color }}>
            {ats.score}
          </span>
          <p className="font-mono text-[10px] uppercase tracking-widest text-mist/60">/ 100</p>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {ats.issues.map((issue, i) => {
          const Icon = ISSUE_ICON[issue.type];
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="flex items-start gap-3 text-sm"
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ISSUE_COLOR[issue.type])} />
              <span className="leading-relaxed text-ink/85">{issue.message}</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
