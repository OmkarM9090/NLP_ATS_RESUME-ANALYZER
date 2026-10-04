"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { Badge, SkillChip } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { formatRatio, formatScore, titleCase } from "@/lib/format";
import type { SkillMatchDetails } from "@/types";

type Filter = "all" | "matched" | "missing" | "partial" | "extra";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "missing", label: "Missing" },
  { key: "partial", label: "Partial" },
  { key: "extra", label: "Extra" },
];

/**
 * Skill grid: matched / missing / partial / extra with precision, recall and F1,
 * plus the per-category split the backend returns.
 */
export function SkillsPanel({ details, className }: { details: SkillMatchDetails; className?: string }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      matched: details.matched?.length ?? 0,
      missing: details.missing?.length ?? 0,
      partial: details.partial?.length ?? 0,
      extra: details.extra?.length ?? 0,
    }),
    [details],
  );

  const categories = useMemo(() => {
    const merged = new Map<string, { matched: string[]; missing: string[] }>();
    Object.entries(details.matched_by_category ?? {}).forEach(([category, skills]) => {
      merged.set(category, { matched: skills ?? [], missing: [] });
    });
    Object.entries(details.missing_by_category ?? {}).forEach(([category, skills]) => {
      const existing = merged.get(category) ?? { matched: [], missing: [] };
      merged.set(category, { matched: existing.matched, missing: skills ?? [] });
    });
    return Array.from(merged.entries())
      .map(([category, value]) => ({
        category,
        ...value,
        total: value.matched.length + value.missing.length,
      }))
      .sort((a, b) => b.total - a.total);
  }, [details.missing_by_category, details.matched_by_category]);

  const total = counts.matched + counts.missing + counts.partial;

  return (
    <Card className={cn("space-y-6", className)}>
      <CardHeader
        eyebrow="Skills"
        title="Skill match"
        description="Canonicalised through a 157-skill taxonomy with 774 aliases, then fuzzy and semantic matching for the rest."
        action={
          <div className="text-right">
            <p className="numeric text-h3 text-ink">{formatScore(details.score ?? 0)}</p>
            <p className="label">skill score</p>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Precision" value={formatRatio(details.precision)} hint="of your listed skills, how many the posting wants" tone="text-secondary-300" />
        <Metric label="Recall" value={formatRatio(details.recall)} hint="of the posting's skills, how many you list" tone="text-primary-200" />
        <Metric label="F1" value={formatRatio(details.f1)} hint="harmonic mean of precision and recall" tone="text-success" />
      </div>

      <ProgressBar
        value={counts.matched + counts.partial * 0.5}
        max={Math.max(1, total)}
        label={`Coverage — ${counts.matched} matched, ${counts.partial} partial, ${counts.missing} missing`}
        showValue
        size="md"
        colorClass="bg-gradient-to-r from-success via-secondary-400 to-primary-500"
      />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((entry) => {
          const active = filter === entry.key;
          const count =
            entry.key === "all" ? total : (counts[entry.key as keyof typeof counts] ?? 0);
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={cn(
                "rounded-pill border px-3 py-1.5 font-mono text-micro uppercase tracking-[0.12em] transition-colors",
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

      <div className="space-y-5">
        {(filter === "all" || filter === "matched") && counts.matched > 0 ? (
          <Group title="Matched" tone="success" count={counts.matched}>
            {details.matched.map((skill) => (
              <SkillChip key={skill} skill={skill} state="matched" />
            ))}
          </Group>
        ) : null}

        {(filter === "all" || filter === "missing") && counts.missing > 0 ? (
          <Group title="Missing from your resume" tone="danger" count={counts.missing}>
            {details.missing.map((skill) => (
              <SkillChip key={skill} skill={skill} state="missing" />
            ))}
          </Group>
        ) : null}

        {(filter === "all" || filter === "partial") && counts.partial > 0 ? (
          <Group title="Partial matches" tone="warning" count={counts.partial}>
            {details.partial.map((entry) => (
              <SkillChip
                key={`${entry.resume}-${entry.jd}`}
                skill={`${entry.resume} → ${entry.jd}`}
                state="partial"
                note={`${entry.match_type} match · similarity ${(entry.similarity * 100).toFixed(0)}%`}
              />
            ))}
          </Group>
        ) : null}

        {(filter === "all" || filter === "extra") && counts.extra > 0 ? (
          <Group title="Extra skills (not requested)" tone="secondary" count={counts.extra}>
            {details.extra.map((skill) => (
              <SkillChip key={skill} skill={skill} state="extra" />
            ))}
          </Group>
        ) : null}

        {total === 0 ? (
          <p className="text-small text-ink-faint">
            No skills were extracted from either document, so there is nothing to compare.
          </p>
        ) : null}
      </div>

      {categories.length > 0 ? (
        <div className="space-y-3 border-t border-line pt-5">
          <p className="label">By category</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {categories.map((entry) => {
              const ratio = entry.total > 0 ? entry.matched.length / entry.total : 0;
              return (
                <motion.li
                  key={entry.category}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 rounded-button border border-line bg-surface/50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small text-ink">
                      {titleCase(entry.category.replace(/_/g, " "))}
                    </span>
                    <span className="block text-micro text-ink-faint">
                      {entry.matched.length}/{entry.total} covered
                      {entry.missing.length > 0 ? ` · missing ${entry.missing.slice(0, 3).join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-pill bg-surface-raised">
                    <span
                      className="block h-full rounded-pill bg-gradient-to-r from-primary-500 to-secondary-400"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface/50 p-4">
      <p className="label">{label}</p>
      <p className={cn("numeric mt-1 text-h3", tone)}>{value}</p>
      <p className="mt-1 text-micro leading-relaxed text-ink-faint">{hint}</p>
    </div>
  );
}

function Group({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "success" | "danger" | "warning" | "secondary";
  children: React.ReactNode;
}) {
  const dot = {
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
    secondary: "bg-secondary-400",
  }[tone];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        <p className="text-small font-medium text-ink">{title}</p>
        <Badge tone="neutral">{count}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
