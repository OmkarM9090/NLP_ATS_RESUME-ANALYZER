import { DENSITY_LABELS, GRADE_LABELS, GRADE_TOKENS, SECTION_LABELS } from "@/lib/constants";
import type { DensityStatus, Grade, Priority } from "@/types";

/* -------------------------------------------------------------------------- */
/* Numbers                                                                     */
/* -------------------------------------------------------------------------- */

/** Clamp to 0-100 and round to one decimal (the backend's own precision). */
export function formatScore(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** 0-1 ratio -> "72%" (used for coverage_ratio, precision, recall, F1). */
export function formatRatio(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 10 ** digits) / 10 ** digits * 100}%`.replace(".0%", "%");
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

export function formatYears(years: number | null | undefined): string {
  if (years === null || years === undefined || Number.isNaN(years)) return "Not detected";
  const rounded = Math.round(years * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} yrs`;
}

export function formatCount(value: number, singular: string, plural?: string): string {
  const noun = value === 1 ? singular : (plural ?? `${singular}s`);
  return `${value.toLocaleString("en-US")} ${noun}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const scaled = bytes / 1024 ** exponent;
  return `${scaled.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatTimestamp(iso);
}

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

export function gradeLabel(grade: Grade): string {
  return GRADE_LABELS[grade] ?? grade;
}

export function gradeHex(grade: Grade): string {
  return GRADE_TOKENS[grade]?.hex ?? "#6366F1";
}

export function gradeTokens(grade: Grade) {
  return GRADE_TOKENS[grade] ?? GRADE_TOKENS.C;
}

/** Continuous colour for a 0-100 score (red -> amber -> cyan -> green). */
export function scoreColor(score: number): string {
  if (score >= 85) return "#10B981";
  if (score >= 70) return "#22D3EE";
  if (score >= 55) return "#F59E0B";
  if (score >= 40) return "#FB923C";
  return "#EF4444";
}

export function gradeForScore(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function sectionLabel(name: string): string {
  return SECTION_LABELS[name] ?? titleCase(name);
}

export function densityLabel(status: DensityStatus | string): string {
  return DENSITY_LABELS[status] ?? titleCase(String(status).replace(/_/g, " "));
}

export function priorityLabel(priority: Priority | string): string {
  return titleCase(String(priority));
}

export function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Human label for a recommendation category key ("missing_skills"). */
export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    missing_skills: "Missing skills",
    missing_keywords: "Missing keywords",
    keyword_optimization: "Keyword optimisation",
    nice_to_have_skills: "Nice-to-have skills",
    skill_focus: "Skill focus",
    score_dimension: "Score dimension",
    experience: "Experience",
    education: "Education",
    section: "Section",
    sections: "Sections",
    ats_formatting: "ATS formatting",
    keyword_density: "Keyword density",
    terminology: "Terminology",
    extraction: "Extraction quality",
    quantified_achievements: "Quantified achievements",
    action_verbs: "Action verbs",
  };
  return map[category] ?? titleCase(category);
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Width style for score bars, always clamped to 0-100%. */
export function barWidth(score: number | null | undefined): string {
  const value = Number(score ?? 0);
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return `${clamped}%`;
}

/** Deterministic pseudo-random in [0,1) for keyword-cloud sizing/rotation. */
export function seededRandom(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** Split a list into `columns` roughly equal chunks (masonry-style grids). */
export function chunk<T>(items: T[], columns: number): T[][] {
  const size = Math.max(1, columns);
  const buckets: T[][] = Array.from({ length: size }, () => []);
  items.forEach((item, index) => buckets[index % size]?.push(item));
  return buckets.filter((bucket) => bucket.length > 0);
}

/** Truncate with an ellipsis, word-boundary aware. */
export function truncate(text: string, limit = 160): string {
  if (!text || text.length <= limit) return text ?? "";
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice}…`;
}

/** Download helper used by the results-page export buttons. */
export function downloadFile(filename: string, contents: string, mime = "application/json"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so Safari finishes the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Slug used for export filenames ("john-doe-resume-analysis.json"). */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "analysis"
  );
}
