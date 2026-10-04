import type {
  ATSFormatting,
  ATSIssue,
  ContactInfo,
  GapAnalysis,
  KeywordAnalysis,
  Recommendation,
  SectionScores,
  SkillsAnalysis,
} from "@/types/analysis";
import type { ParsedSections } from "./section-parser";
import { getCategoryFor } from "./data/skill-taxonomy";

/* ------------------------------------------------------------------
 * Report generator — prioritized recommendations + ATS compatibility
 * formatting check.
 * ------------------------------------------------------------------ */

const PRIORITY_ORDER: Record<Recommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface RecInput {
  gaps: GapAnalysis;
  skills: SkillsAnalysis;
  keywords: KeywordAnalysis;
  sectionScores: SectionScores;
  overall: number;
}

export function generateRecommendations(input: RecInput): Recommendation[] {
  const { gaps, skills, keywords } = input;
  const recs: Recommendation[] = [];

  // HIGH — missing required skills (top 5, individual, grouped by category)
  const requiredMissing = gaps.missing_skills.filter((s) => s.importance === "required");
  for (const { skill } of requiredMissing.slice(0, 4)) {
    const kw = gaps.missing_keywords.find((k) =>
      k.keyword.toLowerCase().includes(skill.toLowerCase().split(" ")[0]),
    );
    recs.push({
      priority: "high",
      category: "Missing Skill",
      message: `“${skill}” is explicitly required by this JD but missing from your resume${kw ? ` (appears ${kw.jd_occurrences}× in the posting)` : ""}.`,
      action: `If you have real experience with ${skill} (${getCategoryFor(skill).replace(/_/g, " ")}), add it to your skills section and back it up inside a work-experience bullet with a concrete outcome.`,
    });
  }

  // HIGH — top missing keywords (grouped)
  const topMissingKw = gaps.missing_keywords.slice(0, 6).map((k) => `“${k.keyword}”`);
  if (topMissingKw.length > 0) {
    recs.push({
      priority: "high",
      category: "Keyword Gap",
      message: `High-priority JD keywords absent from your resume: ${topMissingKw.join(", ")}.`,
      action: "Weave these exact phrases into your summary, skills list, and the most recent roles — ATS rankers match literal keyword forms.",
    });
  }

  // MEDIUM — partial skill terminology mismatches
  for (const p of skills.partial.slice(0, 3)) {
    recs.push({
      priority: "medium",
      category: "Terminology",
      message: `You wrote “${p.resume}” — the JD says “${p.jd}” (${Math.round(p.similarity * 100)}% similar).`,
      action: `Mirror the JD's wording: mention “${p.jd}” explicitly (e.g. in parentheses) so exact-match parsers credit the skill.`,
    });
  }

  // MEDIUM — weak sections
  for (const w of gaps.weak_sections.slice(0, 3)) {
    recs.push({
      priority: "medium",
      category: "Weak Section",
      message: `Your ${w.section} section scores ${w.score}/100 against this JD.`,
      action: w.suggestion,
    });
  }

  // MEDIUM — experience gap
  if (gaps.experience_gap) {
    recs.push({
      priority: "medium",
      category: "Experience",
      message: gaps.experience_gap,
      action: "Add explicit month-year date ranges to every role and quantify scope (team size, users, revenue, uptime) to demonstrate seniority.",
    });
  }

  // MEDIUM — education gap
  if (gaps.education_gap) {
    recs.push({
      priority: "medium",
      category: "Education",
      message: gaps.education_gap,
      action: "State the full degree name (e.g. “B.S. Computer Science”) on its own line, plus relevant coursework if you're early-career.",
    });
  }

  // MEDIUM — keyword density imbalance
  const kd = keywords.keyword_density;
  if (kd.resume < kd.jd * 0.6 && kd.jd > 0) {
    recs.push({
      priority: "medium",
      category: "Keyword Density",
      message: `Your resume's domain-keyword density (${(kd.resume * 100).toFixed(1)}%) trails the JD's (${(kd.jd * 100).toFixed(1)}%) — it may read as under-specialized.`,
      action: "Increase technical specificity: name tools, versions, and frameworks instead of generic phrases like “various technologies”.",
    });
  }

  // LOW — leverage extra skills
  if (skills.extra.length > 6) {
    recs.push({
      priority: "low",
      category: "Focus",
      message: `${skills.extra.length} resume skills aren't referenced by this JD (e.g. ${skills.extra.slice(0, 3).join(", ")}).`,
      action: "Trim or de-emphasize off-target skills so the recruiter's scan time lands on what this role values.",
    });
  }

  // LOW — summary nudge
  if (!input.sectionScores["summary"]) {
    recs.push({
      priority: "low",
      category: "Structure",
      message: "No professional summary section was detected.",
      action: "Add a 2–3 line summary at the top, targeting this exact role title and 3 anchor keywords from the JD.",
    });
  }

  return recs
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 10);
}

/* ------------------------- ATS formatting ------------------------- */

export interface ATSInput {
  rawText: string;
  extractionMethod: string;
  pages: number;
  sections: ParsedSections;
  contacts: ContactInfo;
  wordCount: number;
}

export function runATSCheck(input: ATSInput): ATSFormatting {
  const { rawText, extractionMethod, pages, sections, contacts, wordCount } = input;
  const issues: ATSIssue[] = [];
  let score = 100;

  const push = (issue: ATSIssue, penalty: number) => {
    issues.push(issue);
    score -= penalty;
  };

  if (extractionMethod === "pdf-text-layer" || extractionMethod === "sample-text") {
    push({ type: "success", message: "File is a text-based PDF — ATS parsers can read it." }, 0);
  } else {
    push({ type: "error", message: "Text could not be extracted reliably; the file may be image-based." }, 30);
  }

  if (pages <= 3) {
    push({ type: "success", message: `${pages} page${pages === 1 ? "" : "s"} — within the ideal ATS length.` }, 0);
  } else {
    push({ type: "warning", message: `${pages} pages detected — many ATS workflows favor ≤ 3 pages.` }, 5);
  }

  if (wordCount >= 200 && wordCount <= 1300) {
    push({ type: "success", message: `Word count (${wordCount}) is in the ATS-friendly range.` }, 0);
  } else if (wordCount < 200) {
    push({ type: "warning", message: `Only ${wordCount} words detected — the resume may lack substance for keyword matching.` }, 10);
  } else {
    push({ type: "warning", message: `${wordCount} words is dense — consider tightening to highlight relevance.` }, 5);
  }

  const detected = sections.detected.length;
  if (detected >= 3) {
    push({ type: "success", message: `Standard section headers detected (${sections.detected.join(", ")}).` }, 0);
  } else {
    push({ type: "warning", message: "Few standard section headers detected — use conventional labels: Summary, Experience, Education, Skills." }, 8);
  }

  if (contacts.emails.length > 0) {
    push({ type: "success", message: "Email address detected — contact info is parseable." }, 0);
  } else {
    push({ type: "error", message: "No email address detected — many ATS require it in the header." }, 12);
  }

  if (contacts.phones.length > 0) {
    push({ type: "success", message: "Phone number detected." }, 0);
  } else {
    push({ type: "warning", message: "No phone number detected." }, 4);
  }

  const pipeDensity =
    (rawText.match(/\|/g)?.length ?? 0) / Math.max(rawText.length / 100, 1);
  if (pipeDensity > 1.5) {
    push({ type: "warning", message: "Heavy use of “|” separators or table-like formatting detected — some ATS mangle tables/columns." }, 8);
  } else {
    push({ type: "success", message: "No table-heavy layout detected." }, 0);
  }

  const bulletLines = rawText.split("\n").filter((l) => /^\s*[•\-\*▪◦]/.test(l)).length;
  if (bulletLines >= 3) {
    push({ type: "success", message: `${bulletLines} bullet points detected — scannable structure.` }, 0);
  } else {
    push({ type: "info", message: "Few bullet points detected — bullets improve both ATS and recruiter scanning." }, 0);
  }

  const metricHits = (rawText.match(/(\d+%|\$\d|\d+x\b|\b\d{2,}\+)/gi) ?? []).length;
  if (metricHits >= 2) {
    push({ type: "success", message: `${metricHits} quantified metrics detected (%, $, scale) — great for impact scoring.` }, 0);
  } else {
    push({ type: "info", message: "Few quantified achievements detected — add measurable outcomes (%, $, time saved)." }, 0);
  }

  return { score: Math.max(15, Math.min(100, score)), issues };
}
