/* ------------------------------------------------------------------
 * Shared analysis types — mirror the API response contract exactly.
 * Used by the NLP engine (server), API routes, and the frontend.
 * ------------------------------------------------------------------ */

export interface ScoreComponent {
  score: number; // 0–100
  weight: number;
}

export interface ScoreBreakdown {
  keyword_match: ScoreComponent;
  semantic_similarity: ScoreComponent;
  skill_match: ScoreComponent;
  experience_relevance: ScoreComponent;
  education_match: ScoreComponent;
}

export interface PartialSkillMatch {
  resume: string;
  jd: string;
  similarity: number;
}

export interface SkillsAnalysis {
  matched: string[];
  missing: string[];
  partial: PartialSkillMatch[];
  extra: string[];
}

export interface JDKeyword {
  keyword: string;
  tfidf_score: number;
  found_in_resume: boolean;
}

export interface KeywordAnalysis {
  top_jd_keywords: JDKeyword[];
  keyword_density: { resume: number; jd: number };
}

export interface ContactInfo {
  emails: string[];
  phones: string[];
  urls: string[];
}

export interface ResumeEntities {
  person: string | null;
  organizations: string[];
  locations: string[];
  dates: string[];
  skills: string[];
  certifications: string[];
  degrees: string[];
  contacts: ContactInfo;
  years_of_experience: number | null;
}

export interface JDEntities {
  organization: string | null;
  location: string | null;
  required_skills: string[];
  preferred_skills: string[];
  degree_requirement: string | null;
  experience_requirement: string | null;
  required_years: number | null;
}

export interface EntityExtraction {
  resume: ResumeEntities;
  job_description: JDEntities;
}

export interface SectionScore {
  score: number;
  similarity: number;
  feedback: string;
}
export type SectionScores = Record<string, SectionScore>;

export interface ATSIssue {
  type: "success" | "info" | "warning" | "error";
  message: string;
}

export interface ATSFormatting {
  score: number;
  issues: ATSIssue[];
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface Recommendation {
  priority: RecommendationPriority;
  category: string;
  message: string;
  action: string;
}

export interface MissingKeywordGap {
  keyword: string;
  jd_occurrences: number;
}

export interface MissingSkillGap {
  skill: string;
  importance: "required" | "preferred";
}

export interface WeakSectionGap {
  section: string;
  score: number;
  suggestion: string;
}

export interface GapAnalysis {
  missing_keywords: MissingKeywordGap[];
  missing_skills: MissingSkillGap[];
  weak_sections: WeakSectionGap[];
  experience_gap: string | null;
  education_gap: string | null;
}

export interface NLPMetadata {
  resume_word_count: number;
  jd_word_count: number;
  resume_unique_tokens: number;
  jd_unique_tokens: number;
  resume_pages: number;
  jd_pages: number;
  extraction: { resume: string; jd: string; scanned: boolean };
  processing_time_ms: number;
  models_used: string[];
}

export interface AnalysisResponse {
  id: string;
  timestamp: string;
  filenames: { resume: string; job_description: string };
  overall_score: number;
  score_breakdown: ScoreBreakdown;
  skills_analysis: SkillsAnalysis;
  keyword_analysis: KeywordAnalysis;
  entity_extraction: EntityExtraction;
  section_scores: SectionScores;
  gap_analysis: GapAnalysis;
  ats_formatting: ATSFormatting;
  recommendations: Recommendation[];
  nlp_metadata: NLPMetadata;
}

export interface AnalysisListItem {
  id: string;
  timestamp: string;
  overall_score: number;
  resume_filename: string;
  jd_filename: string;
}

export interface HistoryResponse {
  items: AnalysisListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface HealthResponse {
  ok: boolean;
  database: "up" | "down";
  pipeline: string;
  models_used: string[];
  version: string;
  uptime_s: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
