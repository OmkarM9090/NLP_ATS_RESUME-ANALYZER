"use client";

import { useEffect, useRef, useState } from "react";
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
import { gsap, revealOnScroll } from "@/lib/anim";

/* ------------------------- Section accordion ------------------------ */

export function SectionAccordion({ sections }: { sections: SectionScores }) {
  const entries = Object.entries(sections);
  const [open, setOpen] = useState<string | null>(entries[0]?.[0] ?? null);
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-sec-row]"), {
        trigger: el,
        y: 18,
        stagger: 0.06,
        start: "top 86%",
      });
    }, el);
    return () => ctx.revert();
  }, [sections]);

  if (!entries.length) {
    return (
      <div className="card rounded-2xl p-6">
        <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
          Resume sections
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-mist">
          No standard section headers were detected. Add labelled sections
          (Summary, Experience, Education, Skills) so ATS parsers can segment
          the document — section headers also feed the per-section scoring.
        </p>
      </div>
    );
  }

  return (
    <div ref={scope} className="card rounded-2xl p-6 sm:p-7">
      <h3 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
        Section-by-section fit
      </h3>
      <p className="mt-1 text-[12.5px] text-faint">
        Semantic overlap of each resume section against the whole posting.
      </p>

      <div className="mt-5 space-y-2.5">
        {entries.map(([name, s]) => {
          const color = scoreColor(s.score);
          const isOpen = open === name;
          return (
            <div
              key={name}
              data-sec-row
              className={cn(
                "overflow-hidden rounded-xl border transition-colors duration-300",
                isOpen
                  ? "border-line-ui-strong bg-tint-2"
                  : "border-line-soft bg-tint-1 hover:border-line-ui",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : name)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
              >
                <span className="w-[104px] shrink-0 truncate font-display text-[13.5px] font-semibold capitalize">
                  {name}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-tint-3">
                  <span
                    className="block h-full origin-left rounded-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      background: color,
                      width: `${Math.max(2, s.score)}%`,
                    }}
                  />
                </span>
                <span
                  className="w-8 text-right font-mono text-[13px] font-semibold tabular-nums"
                  style={{ color }}
                >
                  {s.score}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-faint transition-transform duration-300",
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
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="border-t border-line-soft px-4 py-4">
                      <p className="text-[13.5px] leading-relaxed text-mist">
                        {s.feedback}
                      </p>
                      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
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

const ISSUE_LABEL: Record<ATSIssue["type"], string> = {
  success: "pass",
  info: "note",
  warning: "warn",
  error: "fail",
};

export function ATSChecklist({ ats }: { ats: ATSFormatting }) {
  const scope = useRef<HTMLDivElement>(null);
  const color = scoreColor(ats.score);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-issue]"), {
        trigger: el,
        y: 14,
        stagger: 0.05,
        start: "top 86%",
        duration: 0.55,
      });
    }, el);
    return () => ctx.revert();
  }, [ats]);

  const counts = ats.issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div ref={scope} className="card rounded-2xl p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-[-0.02em]">
            <ShieldCheck className="h-4 w-4 text-secondary" strokeWidth={2.2} />
            ATS compatibility
          </h3>
          <p className="mt-1 text-[12.5px] text-faint">
            Formatting heuristics that affect real-world parsing.
          </p>
        </div>
        <div className="text-right">
          <span
            className="font-mono text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums"
            style={{ color }}
          >
            {ats.score}
          </span>
          <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">
            / 100
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(["success", "info", "warning", "error"] as const)
          .filter((t) => counts[t])
          .map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-md border border-line-soft bg-tint-1 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                ISSUE_COLOR[t],
              )}
            >
              {counts[t]} {ISSUE_LABEL[t]}
            </span>
          ))}
      </div>

      <ul className="mt-5 space-y-3">
        {ats.issues.map((issue, i) => {
          const Icon = ISSUE_ICON[issue.type];
          return (
            <li key={i} data-issue className="flex items-start gap-3">
              <Icon
                className={cn("mt-[3px] h-3.5 w-3.5 shrink-0", ISSUE_COLOR[issue.type])}
                strokeWidth={2.2}
              />
              <span className="text-[13px] leading-relaxed text-ink/85">
                {issue.message}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
