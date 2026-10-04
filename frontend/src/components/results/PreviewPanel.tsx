"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { AnalysisResponse } from "@/types";

type Tab = "resume" | "jd";

/**
 * Side-by-side text previews of what was actually parsed.
 *
 * Collapsed by default (the backend truncates previews); expanding shows the
 * full preview string with monospace type so formatting problems are visible.
 */
export function PreviewPanel({ result, className }: { result: AnalysisResponse; className?: string }) {
  const [tab, setTab] = useState<Tab>("resume");
  const [expanded, setExpanded] = useState(false);

  const text = tab === "resume" ? result.resume_preview : result.jd_preview;
  const filename = tab === "resume" ? result.resume_filename : result.jd_filename;

  if (!text) return null;

  return (
    <Card className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Parsed input</p>
          <h3 className="mt-1 text-h5">Document preview</h3>
        </div>
        <div className="flex rounded-pill border border-line p-1">
          {(
            [
              { key: "resume", label: "Resume" },
              { key: "jd", label: "Job description" },
            ] as Array<{ key: Tab; label: string }>
          ).map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              aria-pressed={tab === entry.key}
              className={cn(
                "rounded-pill px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] transition-colors",
                tab === entry.key
                  ? "bg-primary-500/18 text-primary-200"
                  : "text-ink-faint hover:text-ink-muted",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <p className="font-mono text-micro text-ink-faint">{filename}</p>

      <pre
        className={cn(
          "overflow-auto whitespace-pre-wrap rounded-card border border-line bg-bg-deep/60 p-4 font-mono text-micro leading-relaxed text-ink-muted",
          expanded ? "max-h-[560px]" : "max-h-52",
        )}
      >
        {text}
      </pre>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="font-mono text-micro uppercase tracking-[0.14em] text-secondary-300 hover:text-secondary-200"
      >
        {expanded ? "Collapse" : "Expand"}
      </button>
    </Card>
  );
}
