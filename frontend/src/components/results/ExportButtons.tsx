"use client";

import { Button } from "@/components/ui/Button";
import { IconDownload, IconPrint } from "@/components/ui/Icons";
import { downloadFile, formatScore, slugify } from "@/lib/format";
import { toast } from "@/stores/toastStore";
import type { AnalysisResponse } from "@/types";

interface Props {
  result: AnalysisResponse;
  className?: string;
}

/**
 * Export actions: raw JSON, a plain-text summary report, and the browser's print
 * dialogue (the app has a print stylesheet, so this yields a clean one-pager).
 */
export function ExportButtons({ result, className }: Props) {
  const stem = slugify(result.resume_filename || "resume");

  const exportJson = () => {
    try {
      downloadFile(
        `${stem}-ats-analysis.json`,
        JSON.stringify(result, null, 2),
        "application/json",
      );
      toast.success("JSON exported", `${stem}-ats-analysis.json`);
    } catch {
      toast.error("Export failed", "The browser blocked the download.");
    }
  };

  const exportText = () => {
    try {
      downloadFile(`${stem}-ats-report.txt`, buildTextReport(result), "text/plain");
      toast.success("Report exported", `${stem}-ats-report.txt`);
    } catch {
      toast.error("Export failed", "The browser blocked the download.");
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportJson} iconLeft={<IconDownload size={15} />}>
          JSON
        </Button>
        <Button size="sm" variant="outline" onClick={exportText} iconLeft={<IconDownload size={15} />}>
          Text report
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.print()}
          iconLeft={<IconPrint size={15} />}
        >
          Print / PDF
        </Button>
      </div>
    </div>
  );
}

/** Plain-text version of the report — handy for pasting into an email or notes. */
export function buildTextReport(result: AnalysisResponse): string {
  const line = "=".repeat(72);
  const rule = "-".repeat(72);
  const out: string[] = [];

  out.push(line);
  out.push("ATS RESUME MATCH REPORT");
  out.push(line);
  out.push(`Generated:      ${new Date(result.timestamp ?? Date.now()).toLocaleString("en-GB")}`);
  out.push(`Resume:         ${result.resume_filename}`);
  out.push(`Job description: ${result.jd_filename}`);
  out.push("");
  out.push(`OVERALL SCORE:  ${formatScore(result.overall_score)} / 100  (grade ${result.grade})`);
  out.push(`Verdict:        ${result.verdict}`);
  out.push("");

  out.push(rule);
  out.push("SCORE BREAKDOWN");
  out.push(rule);
  Object.entries(result.score_breakdown ?? {}).forEach(([key, component]) => {
    if (!component) return;
    out.push(
      `${key.padEnd(22)} ${formatScore(component.score).padStart(6)} / 100   weight ${(component.weight * 100).toFixed(0)}%   contributes ${component.weighted_score.toFixed(1)}`,
    );
    if (component.detail) out.push(`${" ".repeat(22)} ${component.detail}`);
  });
  out.push("");

  const skills = result.skills_analysis;
  out.push(rule);
  out.push("SKILLS");
  out.push(rule);
  out.push(`Matched (${skills?.matched?.length ?? 0}): ${(skills?.matched ?? []).join(", ") || "none"}`);
  out.push(`Missing (${skills?.missing?.length ?? 0}): ${(skills?.missing ?? []).join(", ") || "none"}`);
  if (skills?.partial?.length) {
    out.push(
      `Partial (${skills.partial.length}): ${skills.partial
        .map((entry) => `${entry.resume} ~ ${entry.jd}`)
        .join(", ")}`,
    );
  }
  out.push("");

  const keywords = result.keyword_analysis;
  const missingKeywords = (keywords?.top_jd_keywords ?? []).filter((entry) => !entry.found_in_resume);
  out.push(rule);
  out.push("KEYWORDS");
  out.push(rule);
  out.push(`TF-IDF cosine similarity: ${(keywords?.tfidf_cosine_similarity ?? 0).toFixed(4)}`);
  out.push(
    `Density (resume / jd):    ${((keywords?.keyword_density?.resume ?? 0) * 100).toFixed(2)}% / ${((keywords?.keyword_density?.jd ?? 0) * 100).toFixed(2)}%`,
  );
  out.push(`Missing top terms:        ${missingKeywords.map((entry) => entry.keyword).join(", ") || "none"}`);
  out.push("");

  out.push(rule);
  out.push("SECTIONS");
  out.push(rule);
  Object.entries(result.section_scores ?? {}).forEach(([name, section]) => {
    if (!section) return;
    out.push(`${name.padEnd(18)} ${formatScore(section.score).padStart(6)}   ${section.present ? "present" : "MISSING"}   ${section.feedback}`);
  });
  out.push("");

  const ats = result.ats_formatting;
  out.push(rule);
  out.push("ATS FORMATTING");
  out.push(rule);
  out.push(`Score: ${formatScore(ats?.score ?? 0)} / 100  (${ats?.checks_passed ?? 0}/${ats?.checks_total ?? 0} checks passed)`);
  (ats?.issues ?? []).forEach((issue) => {
    out.push(`[${issue.type.toUpperCase()}] ${issue.code}: ${issue.message}`);
    if (issue.fix) out.push(`        fix: ${issue.fix}`);
  });
  out.push("");

  out.push(rule);
  out.push("RECOMMENDATIONS");
  out.push(rule);
  (result.recommendations ?? []).forEach((entry, index) => {
    out.push(`${index + 1}. [${entry.priority.toUpperCase()}] ${entry.action}`);
    out.push(`   ${entry.message}`);
    out.push(`   category: ${entry.category} · impact ${entry.impact_score}/100`);
  });
  out.push("");

  const meta = result.nlp_metadata;
  out.push(rule);
  out.push("NLP METADATA");
  out.push(rule);
  out.push(`Processing time:   ${((meta?.processing_time_ms ?? 0) / 1000).toFixed(2)} s`);
  out.push(`Models:            ${(meta?.models_used ?? []).join(", ") || "none reported"}`);
  out.push(`Extraction:        resume ${meta?.resume_extraction_method} / jd ${meta?.jd_extraction_method}`);
  out.push(`Degraded mode:     ${meta?.degraded_mode ? "yes" : "no"}`);
  out.push(`Stages completed:  ${(meta?.pipeline_stages_completed ?? []).join(" → ")}`);
  if (meta?.warnings?.length) {
    out.push("Warnings:");
    meta.warnings.forEach((warning) => out.push(`  - ${warning}`));
  }
  out.push(line);

  return out.join("\n");
}
