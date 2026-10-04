"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-ink-muted border-line",
  primary: "bg-primary-500/14 text-primary-200 border-primary-500/35",
  secondary: "bg-secondary-500/12 text-secondary-200 border-secondary-500/35",
  success: "bg-success/12 text-success border-success/35",
  warning: "bg-warning/12 text-warning border-warning/35",
  danger: "bg-danger/12 text-danger border-danger/35",
  outline: "bg-transparent text-ink-muted border-line-strong",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  /** Small uppercase mono label style. */
  mono?: boolean;
  title?: string;
}

/** Pill label used for skills, severities, statuses and categories. */
export function Badge({ tone = "neutral", children, className, icon, mono = true, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1",
        mono ? "font-mono text-micro uppercase tracking-[0.1em]" : "text-small",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Skill chip with an explicit matched/missing/partial state. */
export function SkillChip({
  skill,
  state,
  note,
  className,
}: {
  skill: string;
  state: "matched" | "missing" | "partial" | "extra";
  note?: string;
  className?: string;
}) {
  const tone: BadgeTone =
    state === "matched" ? "success" : state === "missing" ? "danger" : state === "partial" ? "warning" : "secondary";
  const marker = state === "matched" ? "✓" : state === "missing" ? "✕" : state === "partial" ? "~" : "+";

  return (
    <Badge tone={tone} className={cn("normal-case tracking-normal", className)} title={note}>
      <span className="font-mono text-[11px] leading-none opacity-80">{marker}</span>
      <span className="font-body text-small text-ink">{skill}</span>
    </Badge>
  );
}

/** Severity dot + label for ATS issues and recommendations. */
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    error: { tone: "danger", label: "Error" },
    high: { tone: "danger", label: "High" },
    warning: { tone: "warning", label: "Warning" },
    medium: { tone: "warning", label: "Medium" },
    info: { tone: "secondary", label: "Info" },
    low: { tone: "secondary", label: "Low" },
    success: { tone: "success", label: "Passed" },
  };
  const entry = map[severity] ?? { tone: "neutral" as BadgeTone, label: severity };
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}
