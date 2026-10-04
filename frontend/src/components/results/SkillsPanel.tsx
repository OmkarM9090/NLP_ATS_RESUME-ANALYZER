"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Info, Shuffle, XCircle } from "lucide-react";
import type { SkillsAnalysis } from "@/types/analysis";
import { Badge } from "@/components/ui/primitives";
import { gsap, revealOnScroll } from "@/lib/anim";
import { cn } from "@/lib/utils";

export default function SkillsPanel({ skills }: { skills: SkillsAnalysis }) {
  const scope = useRef<HTMLDivElement>(null);
  const total = skills.matched.length + skills.missing.length + skills.partial.length;

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-skill-card]"), {
        trigger: el,
        y: 28,
        stagger: 0.08,
        start: "top 85%",
      });
      revealOnScroll(el.querySelectorAll("[data-chip]"), {
        trigger: el,
        y: 10,
        stagger: 0.018,
        start: "top 85%",
        duration: 0.5,
      });
    }, el);
    return () => ctx.revert();
  }, [skills]);

  const groups = [
    {
      key: "matched",
      title: "Matched",
      hint: "present in both documents",
      icon: CheckCircle2,
      tone: "success" as const,
      chip: "border-success/25 bg-success/[0.08] text-emerald-300",
      empty: "No exact skill matches detected — review the posting's required stack.",
    },
    {
      key: "missing",
      title: "Missing",
      hint: "required by the posting",
      icon: XCircle,
      tone: "danger" as const,
      chip: "border-danger/25 bg-danger/[0.08] text-red-300",
      empty: "Nothing missing — your resume covers every JD skill detected.",
    },
  ];

  return (
    <div ref={scope}>
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <Badge tone="success">{skills.matched.length} matched</Badge>
        <Badge tone="danger">{skills.missing.length} missing</Badge>
        <Badge tone="warning">{skills.partial.length} partial</Badge>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
          {total} jd skills detected
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((g) => {
          const list = skills[g.key as "matched" | "missing"];
          return (
            <div key={g.key} data-skill-card className="card rounded-2xl p-5">
              <h3 className="flex items-center gap-2 font-display text-[14.5px] font-semibold tracking-[-0.01em]">
                <g.icon
                  className={cn(
                    "h-4 w-4",
                    g.tone === "success" ? "text-success" : "text-danger",
                  )}
                  strokeWidth={2.2}
                />
                {g.title}
                <span className="ml-auto font-mono text-[11px] tabular-nums text-faint">
                  {list.length}
                </span>
              </h3>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                {g.hint}
              </p>

              {list.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {list.map((s) => (
                    <span
                      key={s}
                      data-chip
                      className={cn(
                        "rounded-lg border px-2 py-1 font-mono text-[11px] leading-none",
                        g.chip,
                      )}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[12.5px] leading-relaxed text-faint">{g.empty}</p>
              )}
            </div>
          );
        })}

        <div data-skill-card className="card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-display text-[14.5px] font-semibold tracking-[-0.01em]">
            <Shuffle className="h-4 w-4 text-warning" strokeWidth={2.2} />
            Near misses
            <span className="ml-auto font-mono text-[11px] tabular-nums text-faint">
              {skills.partial.length}
            </span>
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            terminology differs
          </p>

          {skills.partial.length ? (
            <div className="mt-4 space-y-2">
              {skills.partial.map((p) => (
                <div
                  key={`${p.resume}-${p.jd}`}
                  data-chip
                  className="rounded-lg border border-warning/20 bg-warning/[0.06] px-2.5 py-2"
                >
                  <p className="font-mono text-[11px] text-amber-200">
                    {p.resume} <span className="text-amber-200/50">↔</span> {p.jd}
                  </p>
                  <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
                    {Math.round(p.similarity * 100)}% similar
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
              No near-matches — skills either matched exactly or are fully absent.
            </p>
          )}
        </div>
      </div>

      {skills.extra.length > 0 && (
        <div className="card mt-4 rounded-2xl p-5">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-[14.5px] font-semibold tracking-[-0.01em]">
            <Info className="h-4 w-4 text-secondary" strokeWidth={2.2} />
            Extra skills on your resume
            <span className="font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-faint">
              not referenced by this posting
            </span>
          </h3>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {skills.extra.map((s) => (
              <span
                key={s}
                data-chip
                className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 font-mono text-[11px] leading-none text-mist"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
