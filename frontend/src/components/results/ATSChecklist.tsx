"use client";

import { useState } from "react";

import { SeverityBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { IconCheck } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { formatScore, scoreColor } from "@/lib/format";
import type { ATSCheck, IssueSeverity } from "@/types";

type SeverityFilter = "all" | IssueSeverity;

const FILTERS: Array<{ key: SeverityFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "error", label: "Errors" },
  { key: "warning", label: "Warnings" },
  { key: "info", label: "Info" },
  { key: "success", label: "Passed" },
];

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2, success: 3 };

/**
 * ATS formatting audit: the weighted 0–100 score, the pass count, and every
 * issue with its concrete fix.
 *
 * Issues are grouped by severity so a resume with one error and eight passes
 * still leads with the error.
 */
export function ATSChecklist({ check, className }: { check: ATSCheck; className?: string }) {
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const issues = check.issues ?? [];
  const colour = scoreColor(check.score ?? 0);

  const visible = issues
    .filter((issue) => filter === "all" || issue.type === filter)
    .sort((a, b) => (SEVERITY_ORDER[a.type] ?? 9) - (SEVERITY_ORDER[b.type] ?? 9));

  const counts = issues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.type] = (accumulator[issue.type] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <Card className={cn("space-y-6", className)}>
      <CardHeader
        eyebrow="Parser readiness"
        title="ATS formatting audit"
        description="Thirteen parser-hostile patterns are checked and weighted: errors cost three points, warnings two, info one."
        action={
          <div className="text-right">
            <p className="numeric text-h3" style={{ color: colour }}>
              {formatScore(check.score)}
            </p>
            <p className="label">
              {check.checks_passed}/{check.checks_total} passed
            </p>
          </div>
        }
      />

      <ProgressBar
        value={check.score}
        size="md"
        colorClass=""
        scoreColored
        label="Formatting score"
        showValue
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Flag
          ok={check.is_text_based}
          label="Text extractable"
          detail={check.is_text_based ? "A parser can read real text" : "Image-only — OCR required"}
        />
        <Flag
          ok={check.standard_headers_used}
          label="Standard headers"
          detail={
            check.standard_headers_used
              ? "Experience / Education / Skills detected"
              : "Headings may be unrecognisable"
          }
        />
        <Flag
          ok={check.contact_info_found}
          label="Contact info"
          detail={check.contact_info_found ? "Email or phone found" : "No email or phone detected"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        {FILTERS.map((entry) => {
          const active = filter === entry.key;
          const count = entry.key === "all" ? issues.length : (counts[entry.key] ?? 0);
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              disabled={count === 0 && entry.key !== "all"}
              className={cn(
                "rounded-pill border px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] transition-colors disabled:opacity-40",
                active
                  ? "border-primary-400/60 bg-primary-500/14 text-primary-200"
                  : "border-line text-ink-faint hover:border-line-strong hover:text-ink-muted",
              )}
              aria-pressed={active}
            >
              {entry.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-small text-ink-faint">Nothing in this category.</p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((issue) => (
            <li
              key={`${issue.code}-${issue.message}`}
              className={cn(
                "rounded-card border p-4 transition-colors",
                issue.type === "error"
                  ? "border-danger/35 bg-danger/6"
                  : issue.type === "warning"
                    ? "border-warning/30 bg-warning/5"
                    : issue.type === "success"
                      ? "border-success/25 bg-success/5"
                      : "border-line bg-surface/50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <SeverityBadge severity={issue.type} />
                <span className="font-mono text-micro uppercase tracking-[0.12em] text-ink-faint">
                  {issue.code}
                </span>
                {issue.type === "success" ? (
                  <span className="ml-auto text-success">
                    <IconCheck size={16} />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-small font-medium text-ink">{issue.message}</p>
              {issue.fix ? (
                <p className="mt-1.5 text-small leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">Fix: </span>
                  {issue.fix}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Flag({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-card border p-4",
        ok ? "border-success/30 bg-success/6" : "border-danger/35 bg-danger/6",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill border",
          ok ? "border-success/45 text-success" : "border-danger/45 text-danger",
        )}
      >
        {ok ? <IconCheck size={13} /> : <span className="text-micro font-bold">!</span>}
      </span>
      <span className="min-w-0">
        <span className="block text-small font-medium text-ink">{label}</span>
        <span className="block text-micro leading-relaxed text-ink-muted">{detail}</span>
      </span>
    </div>
  );
}
