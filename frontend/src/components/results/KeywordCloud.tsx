"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { densityLabel, formatPercent, formatScore, seededRandom } from "@/lib/format";
import type { KeywordAnalysis, KeywordDensity } from "@/types";

interface Props {
  analysis: KeywordAnalysis;
  className?: string;
}

/**
 * Keyword cloud + coverage table.
 *
 * Size and colour come from TF-IDF importance and whether the term appears in the
 * resume; hovering a chip pins its detail row. Everything below the cloud is the
 * backend's own numbers (density, cosine similarity, RAKE list).
 */
export function KeywordCloud({ analysis, className }: Props) {
  const [active, setActive] = useState<string | null>(null);

  const keywords = useMemo(() => analysis.top_jd_keywords ?? [], [analysis.top_jd_keywords]);
  const maxScore = useMemo(
    () => Math.max(0.0001, ...keywords.map((entry) => entry.tfidf_score ?? 0)),
    [keywords],
  );

  const activeKeyword = useMemo(
    () => keywords.find((entry) => entry.keyword === active) ?? null,
    [active, keywords],
  );

  const coverage = keywords.length
    ? keywords.filter((entry) => entry.found_in_resume).length / keywords.length
    : 0;

  return (
    <Card className={cn("space-y-6", className)}>
      <CardHeader
        eyebrow="Keywords"
        title="Keyword coverage"
        description="Terms ranked in the job description by TF-IDF, RAKE and TextRank, checked against your resume."
        action={
          <div className="text-right">
            <p className="numeric text-h3 text-ink">{formatScore(analysis.tfidf_cosine_similarity * 100)}</p>
            <p className="label">tf-idf cosine</p>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <DensityStat label="Resume density" value={formatPercent(analysis.keyword_density?.resume ?? 0, 2)} status={analysis.keyword_density?.resume_status} />
        <DensityStat label="JD density" value={formatPercent(analysis.keyword_density?.jd ?? 0, 2)} status={analysis.keyword_density?.jd_status} />
        <DensityStat
          label="Top-term coverage"
          value={formatPercent(coverage * 100, 0)}
          hint={`${keywords.filter((entry) => entry.found_in_resume).length}/${keywords.length} found`}
        />
      </div>

      {/* Cloud */}
      <div className="relative flex min-h-[190px] flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-card border border-line bg-bg-deep/40 p-6">
        {keywords.length === 0 ? (
          <p className="text-small text-ink-faint">No keywords were extracted.</p>
        ) : (
          keywords.map((entry) => {
            const weight = entry.tfidf_score / maxScore;
            const size = 12 + weight * 22; // 12px → 34px
            const rotation = (seededRandom(entry.keyword) - 0.5) * 5;
            const found = entry.found_in_resume;
            const isActive = active === entry.keyword;
            return (
              <button
                key={entry.keyword}
                type="button"
                onMouseEnter={() => setActive(entry.keyword)}
                onFocus={() => setActive(entry.keyword)}
                onClick={() => setActive(isActive ? null : entry.keyword)}
                className={cn(
                  "cursor-pointer whitespace-nowrap rounded-button px-1.5 py-0.5 font-heading transition-all duration-200",
                  found
                    ? "text-success hover:text-success/80"
                    : "text-danger/85 hover:text-danger",
                  isActive && "bg-surface-raised ring-1 ring-primary-400/40",
                )}
                style={{ fontSize: `${size}px`, transform: `rotate(${rotation}deg)`, opacity: 0.55 + weight * 0.45 }}
                title={`${entry.keyword} — ${found ? "found" : "missing"} in resume · TF-IDF ${entry.tfidf_score.toFixed(3)}`}
                aria-label={`${entry.keyword}, ${found ? "present" : "missing"} in your resume`}
              >
                {entry.keyword}
              </button>
            );
          })
        )}

        <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-3 font-mono text-micro text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> in resume
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" /> missing
          </span>
        </div>
      </div>

      {activeKeyword ? (
        <div className="flex flex-wrap items-center gap-3 rounded-button border border-line bg-surface/60 px-4 py-3">
          <span className="text-body font-medium text-ink">{activeKeyword.keyword}</span>
          <Badge tone={activeKeyword.found_in_resume ? "success" : "danger"}>
            {activeKeyword.found_in_resume ? "found in resume" : "missing from resume"}
          </Badge>
          <span className="numeric text-small text-ink-muted">
            tf-idf {activeKeyword.tfidf_score.toFixed(3)}
          </span>
          <span className="numeric text-small text-ink-muted">
            jd occurrences {activeKeyword.occurrences}
          </span>
          <span className="numeric text-small text-ink-muted">
            importance {(activeKeyword.importance * 100).toFixed(0)}%
          </span>
        </div>
      ) : null}

      <KeywordTable analysis={analysis} />
    </Card>
  );
}

function DensityStat({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string;
  status?: KeywordDensity["resume_status"];
  hint?: string;
}) {
  const tone =
    status === "optimal"
      ? "text-success"
      : status === "over_optimized"
        ? "text-danger"
        : status === "under_optimized"
          ? "text-warning"
          : "text-ink";

  return (
    <div className="rounded-card border border-line bg-surface/50 p-4">
      <p className="label">{label}</p>
      <p className={cn("numeric mt-1 text-h4", tone)}>{value}</p>
      <p className="mt-1 text-micro text-ink-faint">
        {status ? densityLabel(status) : (hint ?? "")}
      </p>
    </div>
  );
}

function KeywordTable({ analysis }: { analysis: KeywordAnalysis }) {
  const missing = (analysis.top_jd_keywords ?? []).filter((entry) => !entry.found_in_resume);
  const rake = (analysis.rake_keywords ?? []).slice(0, 12);

  return (
    <div className="grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="label">Highest-impact missing terms</p>
        {missing.length === 0 ? (
          <p className="text-small text-success">
            Every top job-description keyword appears in your resume.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {missing.slice(0, 10).map((entry, index) => (
              <li key={entry.keyword} className="flex items-baseline gap-3 text-small">
                <span className="numeric w-5 shrink-0 text-micro text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{entry.keyword}</span>
                <span className="numeric shrink-0 text-micro text-ink-muted">
                  importance {(entry.importance * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-3">
        <p className="label">RAKE key phrases</p>
        {rake.length === 0 ? (
          <p className="text-small text-ink-faint">No multi-word phrases were extracted.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rake.map((entry) => (
              <Badge key={entry.keyword} tone="outline" className="normal-case tracking-normal">
                <span className="font-body text-small text-ink-muted">{entry.keyword}</span>
                <span className="numeric text-micro text-ink-faint">{entry.score.toFixed(2)}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
