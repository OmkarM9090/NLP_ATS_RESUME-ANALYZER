import type { ProcessedDoc } from "./tokenizer";
import type {
  JDEntities,
  ResumeEntities,
  ScoreBreakdown,
  SkillsAnalysis,
} from "@/types/analysis";
import type { SemanticResult } from "./semantic-analyzer";
import {
  extractCombinedKeywords,
  keywordPresentInDoc,
} from "./keyword-extractor";
import { skillCoverage } from "./skill-matcher";
import { extractDegrees, highestEducationLevel } from "./entity-extractor";
import { clamp01, round1 } from "@/lib/utils";

/* ------------------------------------------------------------------
 * Multi-dimensional similarity engine:
 *   keyword_match        × 0.25  (TF-IDF coverage + cosine)
 *   semantic_similarity  × 0.30  (sentence-coverage semantics)
 *   skill_match          × 0.25  (taxonomy exact + fuzzy)
 *   experience_relevance × 0.10  (years + recency)
 *   education_match      × 0.10  (degree-level comparison)
 * ------------------------------------------------------------------ */

export const SCORE_WEIGHTS = {
  keyword_match: 0.25,
  semantic_similarity: 0.3,
  skill_match: 0.25,
  experience_relevance: 0.1,
  education_match: 0.1,
} as const;

export interface ScoringInput {
  resume: ProcessedDoc;
  jd: ProcessedDoc;
  skills: SkillsAnalysis;
  resumeEntities: ResumeEntities;
  jdEntities: JDEntities;
  semantic: SemanticResult;
}

export interface ScoringOutput {
  breakdown: ScoreBreakdown;
  overall: number;
  jdKeywords: { keyword: string; tfidf_score: number; found_in_resume: boolean }[];
}

function computeKeywordScore(
  resume: ProcessedDoc,
  jd: ProcessedDoc,
  semanticCosine: number,
): { score: number; jdKeywords: ScoringOutput["jdKeywords"] } {
  const jdKeywords = extractCombinedKeywords(jd, 22);
  if (jdKeywords.length === 0) {
    return { score: 0, jdKeywords: [] };
  }

  const maxScore = Math.max(...jdKeywords.map((k) => k.score), 0.0001);
  let weightedFound = 0;
  let weightedTotal = 0;

  const annotated = jdKeywords.map((k) => {
    const weight = k.score / maxScore;
    const found = keywordPresentInDoc(k.keyword, resume);
    weightedTotal += weight;
    if (found) weightedFound += weight;
    return {
      keyword: k.keyword,
      tfidf_score: Math.round((k.score / maxScore) * 1000) / 1000, // normalized 0..1
      found_in_resume: found,
    };
  });

  const coverage01 = weightedTotal > 0 ? weightedFound / weightedTotal : 0;
  const calibratedCos = clamp01(semanticCosine / 0.5);
  const score = round1((0.62 * coverage01 + 0.38 * calibratedCos) * 100);
  return { score, jdKeywords: annotated };
}

function computeSkillScore(skills: SkillsAnalysis, jdSkillCount: number): number {
  if (jdSkillCount === 0) return 45; // JD listed no recognizable taxonomy skills
  return round1(clamp01(skillCoverage(skills, jdSkillCount)) * 100);
}

function computeExperienceScore(
  resumeEntities: ResumeEntities,
  jdEntities: JDEntities,
): number {
  const req = jdEntities.required_years;
  const have = resumeEntities.years_of_experience;

  if (req && have != null) {
    const ratio = have / req;
    if (ratio >= 1) return 100;
    return round1(42 + 58 * Math.pow(ratio, 0.8));
  }
  if (req && have == null) return 50; // cannot verify
  if (!req && have != null) return 82; // no explicit requirement, experience present
  return 65;
}

function computeEducationScore(resume: ProcessedDoc, jd: ProcessedDoc): number {
  const jdLevel = highestEducationLevel(extractDegrees(jd.cleaned.text));
  const resumeLevel = highestEducationLevel(extractDegrees(resume.cleaned.text));

  if (jdLevel === 0) return resumeLevel > 0 ? 85 : 78; // no stated requirement
  if (resumeLevel >= jdLevel) return 100;
  const diff = jdLevel - resumeLevel;
  if (resumeLevel === 0) return 42;
  if (diff === 1) return 72;
  if (diff === 2) return 48;
  return 30;
}

export function computeScores(input: ScoringInput): ScoringOutput {
  const { resume, jd, skills, resumeEntities, jdEntities, semantic } = input;

  const { score: keywordScore, jdKeywords } = computeKeywordScore(
    resume,
    jd,
    semantic.cosineSimilarity,
  );

  const jdSkillCount = jdEntities.required_skills.length;
  const skillScore = computeSkillScore(skills, jdSkillCount);
  const semanticScore = round1(semantic.score01 * 100);
  const experienceScore = computeExperienceScore(resumeEntities, jdEntities);
  const educationScore = computeEducationScore(resume, jd);

  const breakdown: ScoreBreakdown = {
    keyword_match: { score: keywordScore, weight: SCORE_WEIGHTS.keyword_match },
    semantic_similarity: { score: semanticScore, weight: SCORE_WEIGHTS.semantic_similarity },
    skill_match: { score: skillScore, weight: SCORE_WEIGHTS.skill_match },
    experience_relevance: { score: experienceScore, weight: SCORE_WEIGHTS.experience_relevance },
    education_match: { score: educationScore, weight: SCORE_WEIGHTS.education_match },
  };

  const overall = round1(
    keywordScore * SCORE_WEIGHTS.keyword_match +
      semanticScore * SCORE_WEIGHTS.semantic_similarity +
      skillScore * SCORE_WEIGHTS.skill_match +
      experienceScore * SCORE_WEIGHTS.experience_relevance +
      educationScore * SCORE_WEIGHTS.education_match,
  );

  return { breakdown, overall, jdKeywords };
}
