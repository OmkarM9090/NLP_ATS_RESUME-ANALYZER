"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { formatPercent, formatScore, sectionLabel } from "@/lib/format";
import type { GapAnalysis } from "@/types";

/**
 * Gap analysis: missing keywords, missing skills, weak sections, experience and
 * education gaps, terminology mismatches, and overall coverage.
 */
export function GapPanel({ gap, className }: { gap: GapAnalysis; className?: string }) {
  const missingKeywords = gap.missing_keywords ?? [];
  const missingSkills = gap.missing_skills ?? [];
  const weakSections = gap.weak_sections ?? [];
  const mismatches = gap.terminology_mismatches ?? [];

  return (
    <Card className={cn("space-y-6", className)}>
      <CardHeader
        eyebrow="Gaps"
        title="What is missing"
        description="Derived from the job description's own emphasis: required skills and high-frequency keywords rank above nice-to-haves."
        action={
          <div className="text-right">
            <p className="numeric text-h3 text-ink">{formatPercent(gap.coverage_ratio ?? 0)}</p>
            <p className="label">coverage ratio</p>
          </div>
        }
      />

      <ProgressBar
        value={(gap.coverage_ratio ?? 0) * 100}
        size="md"
        label="Share of the posting's signals your resume covers"
        showValue
        colorClass="bg-gradient-to-r from-danger via-warning to-success"
      />

      {(gap.experience_gap || gap.education_gap) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {gap.experience_gap ? (
            <Notice label="Experience gap" body={gap.experience_gap} tone="warning" />
          ) : null}
          {gap.education_gap ? (
            <Notice label="Education gap" body={gap.education_gap} tone="warning" />
          ) : null}
        </div>
      )}

      <div className="grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
        <Column
          title="Missing keywords"
          count={missingKeywords.length}
          empty="Every significant keyword in the posting appears in your resume."
        >
          <ul className="space-y-2">
            {missingKeywords.slice(0, 12).map((entry) => (
              <li
                key={entry.keyword}
                className="flex items-center gap-3 rounded-button border border-line bg-surface/50 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-small text-ink">{entry.keyword}</span>
                <span className="numeric shrink-0 text-micro text-ink-faint">
                  ×{entry.occurrences} · {(entry.importance * 100).toFixed(0)}%
                </span>
                <SeverityBadge severity={entry.severity} />
              </li>
            ))}
          </ul>
        </Column>

        <Column
          title="Missing skills"
          count={missingSkills.length}
          empty="No skills are missing from your resume."
        >
          <ul className="space-y-2">
            {missingSkills.slice(0, 12).map((entry) => (
              <li
                key={`${entry.skill}-${entry.category}`}
                className="flex items-center gap-3 rounded-button border border-line bg-surface/50 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-small text-ink">{entry.skill}</span>
                <span className="hidden font-mono text-micro uppercase tracking-[0.1em] text-ink-faint sm:block">
                  {entry.category}
                </span>
                <SeverityBadge severity={entry.importance} />
              </li>
            ))}
          </ul>
        </Column>
      </div>

      {weakSections.length > 0 ? (
        <div className="space-y-3 border-t border-line pt-5">
          <div className="flex items-center gap-2.5">
            <p className="label">Weak sections</p>
            <Badge tone="neutral">{weakSections.length}</Badge>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {weakSections.map((entry) => (
              <li key={entry.section} className="rounded-card border border-warning/25 bg-warning/5 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-small font-semibold text-ink">{sectionLabel(entry.section)}</p>
                  <p className="numeric text-small text-warning">{formatScore(entry.score)}</p>
                </div>
                <p className="mt-1.5 text-small leading-relaxed text-ink-muted">{entry.issue}</p>
                <p className="mt-2 text-micro leading-relaxed text-ink-faint">
                  <span className="font-medium text-ink-muted">Suggestion: </span>
                  {entry.suggestion}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mismatches.length > 0 ? (
        <div className="space-y-3 border-t border-line pt-5">
          <p className="label">Terminology mismatches</p>
          <p className="text-small text-ink-muted">
            You say it one way, the posting says it another. ATS keyword filters are literal — mirror
            the posting's wording where it is honest to do so.
          </p>
          <ul className="flex flex-wrap gap-2">
            {mismatches.map((entry) => (
              <li
                key={`${entry.resume}-${entry.jd}`}
                className="rounded-pill border border-line bg-surface/60 px-3 py-1.5 text-small"
                title={`${entry.match_type} match · similarity ${(entry.similarity * 100).toFixed(0)}%`}
              >
                <span className="text-ink">{entry.resume}</span>
                <span className="mx-2 text-ink-faint">→</span>
                <span className="text-secondary-300">{entry.jd}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Column({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <p className="label">{title}</p>
        <Badge tone={count > 0 ? "warning" : "success"}>{count}</Badge>
      </div>
      {count === 0 ? <p className="text-small text-success">{empty}</p> : children}
    </div>
  );
}

function Notice({ label, body, tone }: { label: string; body: string; tone: "warning" | "danger" }) {
  return (
    <div
      className={cn(
        "rounded-card border p-4",
        tone === "warning" ? "border-warning/30 bg-warning/6" : "border-danger/35 bg-danger/6",
      )}
    >
      <p className="label">{label}</p>
      <p className="mt-1.5 text-small leading-relaxed text-ink">{body}</p>
    </div>
  );
}
