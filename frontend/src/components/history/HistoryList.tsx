"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { gsap } from "@/lib/gsap-config";
import { formatDate, scoreColor, scoreLabel } from "@/lib/utils";
import type { HistoryRow } from "@/lib/analysis-store";
import DeleteButton from "./DeleteButton";

/**
 * History rows are fetched on the server (RSC) and revealed here with a
 * staggered GSAP entrance — keeps the data path unchanged.
 */
export default function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const scope = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const items = el.querySelectorAll("[data-row]");
      if (!items.length) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        items,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.75, stagger: 0.055, ease: "power3.out" },
      );
    }, el);
    return () => ctx.revert();
  }, [rows]);

  return (
    <ul ref={scope} className="mt-5 space-y-2.5">
      {rows.map((r) => {
        const color = scoreColor(r.overallScore);
        const label = scoreLabel(r.overallScore).split(" ")[0];
        return (
          <li key={r.id} data-row>
            <div className="card card-hover group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 sm:gap-4 sm:px-5">
              {/* stretched link — the whole row is one tap target on every
                  screen size, delete stays clickable above it */}
              <Link
                href={`/results?id=${r.id}`}
                className="absolute inset-0 z-0 rounded-2xl"
                aria-label={`Open analysis: ${r.resumeFilename} versus ${r.jdFilename}, score ${Math.round(r.overallScore)}`}
              />

              <div
                className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl sm:h-14 sm:w-14"
                style={{
                  background: `${color}12`,
                  boxShadow: `inset 0 0 0 1px ${color}40`,
                }}
              >
                <span
                  className="font-mono text-[15px] font-bold leading-none tabular-nums sm:text-[17px]"
                  style={{ color }}
                >
                  {Math.round(r.overallScore)}
                </span>
                <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                  {label}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[13.5px] font-semibold tracking-[-0.01em] text-ink sm:text-[14px]">
                  {r.resumeFilename}
                  <span className="mx-2 font-mono text-[11px] font-normal text-faint">
                    vs
                  </span>
                  <span className="font-sans font-normal text-mist">{r.jdFilename}</span>
                </p>
                <p className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-faint sm:text-[10.5px]">
                  {formatDate(r.createdAt.toISOString())} · {r.grade} · id{" "}
                  {r.id.slice(0, 8)}
                </p>
              </div>

              <span className="hidden h-9 items-center gap-1.5 rounded-lg border border-line-ui px-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist transition-all duration-300 group-hover:border-line-ui-strong group-hover:text-ink sm:inline-flex">
                open
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink sm:hidden" />

              <span className="relative z-10 shrink-0">
                <DeleteButton id={r.id} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
