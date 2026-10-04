import type {
  GapAnalysis,
  JDEntities,
  ResumeEntities,
  SectionScores,
  SkillsAnalysis,
} from "@/types/analysis";
import type { ProcessedDoc } from "./tokenizer";
import { countOccurrences } from "./keyword-extractor";
import { extractDegrees, highestEducationLevel } from "./entity-extractor";
import type { ScoringOutput } from "./similarity-engine";

/* ------------------------------------------------------------------
 * Gap analyzer — what's missing, what's weak, and why it matters.
 * ------------------------------------------------------------------ */

const SECTION_SUGGESTIONS: Record<string, string> = {
  summary:
    "Rewrite your summary to mirror the JD's language — name the role, your years of experience, and 2–3 core technologies from the posting.",
  experience:
    "Strengthen bullet points with JD terminology and quantified outcomes (%, $, latency, scale). Lead with action verbs that match the posting.",
  skills:
    "Expand your skills section with the exact technologies named in the JD. Group them (Languages, Frameworks, Cloud, Data) for ATS parsing.",
  education:
    "Make your education section explicit — full degree name, institution, graduation year — so ATS parsers match the requirement.",
  projects:
    "Add 1–2 projects that demonstrate the JD's core stack with measurable results and links.",
  certifications:
    "List certifications that map to the JD's requirements (cloud, security, PM). Include issuing body and year.",
};

export interface GapInput {
  resume: ProcessedDoc;
  jd: ProcessedDoc;
  skills: SkillsAnalysis;
  resumeEntities: ResumeEntities;
  jdEntities: JDEntities;
  scoring: ScoringOutput;
  sectionScores: SectionScores;
}

export function analyzeGaps(input: GapInput): GapAnalysis {
  const { jd, skills, resumeEntities, jdEntities, scoring, sectionScores } = input;

  const missingKeywords = scoring.jdKeywords
    .filter((k) => !k.found_in_resume)
    .slice(0, 12)
    .map((k) => ({
      keyword: k.keyword,
      jd_occurrences: Math.max(1, countOccurrences(k.keyword, jd)),
    }));

  const preferredSet = new Set(jdEntities.preferred_skills);
  const missingSkills = skills.missing.slice(0, 15).map((s) => ({
    skill: s,
    importance: (preferredSet.has(s) ? "preferred" : "required") as
      | "required"
      | "preferred",
  }));

  const weakSections = Object.entries(sectionScores)
    .filter(([, v]) => v.score < 58)
    .map(([section, v]) => ({
      section,
      score: v.score,
      suggestion:
        SECTION_SUGGESTIONS[section] ??
        `This section overlaps weakly with the JD. Align its vocabulary with the posting and add concrete, role-relevant detail.`,
    }));

  let experienceGap: string | null = null;
  const req = jdEntities.required_years;
  const have = resumeEntities.years_of_experience;
  if (req && have != null && have < req) {
    experienceGap = `The JD asks for ${req}+ years of experience, but your resume indicates ~${have} years. Surface internships, freelance, or project work to close the gap, or emphasize depth of impact per year.`;
  } else if (req && have == null) {
    experienceGap = `The JD asks for ${req}+ years of experience, but your resume doesn't state years clearly. Add explicit date ranges (e.g. "2019 – Present") to each role.`;
  }

  const jdLevel = highestEducationLevel(extractDegrees(jd.cleaned.text));
  const resumeLevel = highestEducationLevel(extractDegrees(input.resume.cleaned.text));
  let educationGap: string | null = null;
  if (jdLevel > 0 && resumeLevel < jdLevel && jdEntities.degree_requirement) {
    educationGap = `The JD prefers “${jdEntities.degree_requirement}”, which your resume may not clearly satisfy. Make your highest degree unambiguous, or offset with certifications and equivalent experience.`;
  }

  return {
    missing_keywords: missingKeywords,
    missing_skills: missingSkills,
    weak_sections: weakSections,
    experience_gap: experienceGap,
    education_gap: educationGap,
  };
}
