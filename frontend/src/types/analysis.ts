/* ------------------------------------------------------------------
 * Shared analysis types — mirror the API response contract exactly
 * (backend/models/schemas.py is the source of truth).
 * ------------------------------------------------------------------ */

export interface ScoreComponent {
  score: number; // 0–100
  weight: number;
  weighted_score?: number;
  detail?: string;
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
  match_type?: string;
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
  occurrences?: number;
  importance?: number;
}

export interface KeywordAnalysis {
  top_jd_keywords: JDKeyword[];
  top_resume_keywords?: JDKeyword[];
  common_keywords?: string[];
  keyword_density: {
    resume: number;
    jd: number;
    resume_status?: string;
    jd_status?: string;
  };
  tfidf_cosine_similarity?: number;
}

export interface ResumeEntities {
  person: string | null;
  organizations: string[];
  locations: string[];
  dates: string[];
  skills: string[];
  certifications: string[];
  degrees: string[];
  emails: string[];
  phones: string[];
  urls: string[];
  years_experience: number | null;
  education_level?: string | null;
  job_titles?: string[];
}

export interface JDEntities {
  organization: string | null;
  location: string | null;
  job_title?: string | null;
  required_skills: string[];
  preferred_skills: string[];
  soft_skills?: string[];
  degree_requirement: string | null;
  experience_requirement: string | null;
  min_years_experience: number | null;
  salary_range?: string | null;
  certifications?: string[];
}

export interface EntityExtraction {
  resume: ResumeEntities;
  job_description: JDEntities;
}

export interface SectionScore {
  score: number;
  similarity: number;
  feedback: string;
  present?: boolean;
  suggestions?: string[];
}
export type SectionScores = Record<string, SectionScore>;

export type IssueType = "success" | "info" | "warning" | "error";

export interface ATSIssue {
  type: IssueType;
  message: string;
  code?: string;
  fix?: string;
}

export interface ATSFormatting {
  score: number;
  issues: ATSIssue[];
  checks_passed?: number;
  checks_total?: number;
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface Recommendation {
  priority: RecommendationPriority;
  category: string;
  message: string;
  action: string;
  impact_score?: number;
}

export interface MissingKeywordGap {
  keyword: string;
  occurrences: number;
  importance?: number;
  severity?: RecommendationPriority;
}

export interface MissingSkillGap {
  skill: string;
  category?: string;
  /** "high" = listed as required, "medium" = mentioned, "low" = preferred/nice-to-have */
  importance: "high" | "medium" | "low";
  mentioned_in_jd?: number;
}

export interface WeakSectionGap {
  section: string;
  score: number;
  issue?: string;
  suggestion: string;
}

export interface GapAnalysis {
  missing_keywords: MissingKeywordGap[];
  missing_skills: MissingSkillGap[];
  weak_sections: WeakSectionGap[];
  experience_gap: string | null;
  education_gap: string | null;
  terminology_mismatches?: PartialSkillMatch[];
  coverage_ratio?: number;
}

export interface NLPMetadata {
  resume_word_count: number;
  jd_word_count: number;
  resume_unique_tokens: number;
  jd_unique_tokens: number;
  resume_sentence_count?: number;
  jd_sentence_count?: number;
  resume_pages: number;
  jd_pages: number;
  processing_time_ms: number;
  models_used: string[];
  resume_extraction_method?: string;
  jd_extraction_method?: string;
  resume_is_scanned?: boolean;
  jd_is_scanned?: boolean;
  degraded_mode?: boolean;
  warnings?: string[];
}

export interface AnalysisResponse {
  id: string;
  timestamp: string;
  resume_filename: string;
  jd_filename: string;
  overall_score: number;
  grade?: string;
  verdict?: string;
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
  grade?: string;
  resume_filename: string;
  jd_filename: string;
  processing_time_ms?: number;
  preview?: string;
  top_matched_skills?: string[];
  top_missing_skills?: string[];
}

export interface HistoryResponse {
  items: AnalysisListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ModelStatus {
  name: string;
  loaded: boolean;
  loading?: boolean;
  variant?: string;
  error?: string | null;
  load_time_ms?: number | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment?: string;
  uptime_seconds: number;
  timestamp?: string;
  models: Record<string, ModelStatus>;
  ocr_available: boolean;
  database_ok: boolean;
  analyses_count: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
