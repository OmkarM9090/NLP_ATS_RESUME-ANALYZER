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
            <div className="card card-hover group flex items-center gap-4 rounded-2xl px-4 py-3.5 sm:px-5">
              <div
                className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
                style={{
                  background: `${color}12`,
                  boxShadow: `inset 0 0 0 1px ${color}40`,
                }}
              >
                <span
                  className="font-mono text-[17px] font-bold leading-none tabular-nums"
                  style={{ color }}
                >
                  {Math.round(r.overallScore)}
                </span>
                <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                  {label}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[14px] font-semibold tracking-[-0.01em] text-ink">
                  {r.resumeFilename}
                  <span className="mx-2 font-mono text-[11px] font-normal text-faint">
                    vs
                  </span>
                  <span className="font-sans font-normal text-mist">{r.jdFilename}</span>
                </p>
                <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                  {formatDate(r.createdAt.toISOString())} · {r.grade} · id{" "}
                  {r.id.slice(0, 8)}
                </p>
              </div>

              <Link
                href={`/results?id=${r.id}`}
                className="hidden h-9 items-center gap-1.5 rounded-lg border border-line-ui px-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist transition-all duration-300 hover:border-line-ui-strong hover:text-ink sm:inline-flex"
              >
                open
                <ArrowRight className="h-3 w-3" />
              </Link>

              <DeleteButton id={r.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
