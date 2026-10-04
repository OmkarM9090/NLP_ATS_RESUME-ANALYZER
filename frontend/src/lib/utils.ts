import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const clamp01 = (v: number) => clamp(v, 0, 1);

export const round1 = (v: number) => Math.round(v * 10) / 10;

export type ScoreTone = "success" | "warning" | "danger";

export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

export function scoreGradient(score: number): [string, string] {
  if (score >= 80) return ["#10B981", "#06B6D4"];
  if (score >= 60) return ["#F59E0B", "#F97316"];
  return ["#EF4444", "#EC4899"];
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent Match";
  if (score >= 70) return "Strong Match";
  if (score >= 55) return "Moderate Match";
  if (score >= 40) return "Weak Match";
  return "Low Match";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pluralize(n: number, word: string, plural?: string): string {
  return n === 1 ? word : plural ?? `${word}s`;
}
