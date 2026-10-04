/**
 * Typed contract for the FastAPI backend.
 *
 * These interfaces mirror `backend/models/schemas.py` field-for-field so the UI
 * can consume `POST /api/analyze` without defensive `any` casts. Optional
 * fields mirror Pydantic defaults (`None` -> `null`).
 */

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export type Priority = "high" | "medium" | "low";
export type IssueSeverity = "error" | "warning" | "info" | "success";
export type ExtractionMethod =
  | "pdfplumber"
  | "ocr_tesseract"
  | "hybrid"
  | "plain_text"
  | "docx"
  | "failed";

export type Grade = "A" | "B" | "C" | "D" | "F";

export type SectionName =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "awards"
  | "languages"
  | "volunteering"
  | "references"
  | "unstructured";

export type ScoreDimension =
  | "keyword_match"
  | "semantic_similarity"
  | "skill_match"
  | "experience_relevance"
  | "education_match";

/* -------------------------------------------------------------------------- */
/* Analysis response                                                           */
/* -------------------------------------------------------------------------- */

export interface ScoreComponent {
  score: number;
  weight: number;
  weighted_score: number;
  detail: string;
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
  match_type: "fuzzy" | "semantic" | string;
}

export interface SkillsAnalysis {
  matched: string[];
  missing: string[];
  partial: PartialSkillMatch[];
  extra: string[];
}

export interface SkillMatchDetails {
  matched: string[];
  missing: string[];
  partial: PartialSkillMatch[];
  extra: string[];
  resume_skills: string[];
  jd_skills: string[];
  matched_by_category: Record<string, string[]>;
  missing_by_category: Record<string, string[]>;
  precision: number;
  recall: number;
  f1: number;
  score: number;
}

export interface JDKeyword {
  keyword: string;
  tfidf_score: number;
  found_in_resume: boolean;
  occurrences: number;
  importance: number;
}

export interface KeywordDensity {
  resume: number;
  jd: number;
  resume_status: DensityStatus;
  jd_status: DensityStatus;
}

export type DensityStatus = "under_optimized" | "optimal" | "over_optimized";

export interface KeywordScore {
  keyword: string;
  score: number;
  method: string;
  count: number;
}

export interface KeywordAnalysis {
  top_jd_keywords: JDKeyword[];
  top_resume_keywords: JDKeyword[];
  common_keywords: string[];
  keyword_density: KeywordDensity;
  tfidf_cosine_similarity: number;
  rake_keywords: KeywordScore[];
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
  education_level: EducationLevel | null;
  job_titles: string[];
}

export type EducationLevel =
  | "high_school"
  | "certification"
  | "associate"
  | "bachelor"
  | "master"
  | "phd";

export interface JobDescriptionEntities {
  organization: string | null;
  location: string | null;
  job_title: string | null;
  required_skills: string[];
  preferred_skills: string[];
  soft_skills: string[];
  degree_requirement: string | null;
  experience_requirement: string | null;
  min_years_experience: number | null;
  salary_range: string | null;
  certifications: string[];
}

export interface EntityExtraction {
  resume: ResumeEntities;
  job_description: JobDescriptionEntities;
}

export interface SectionScore {
  score: number;
  feedback: string;
  similarity: number;
  present: boolean;
  suggestions: string[];
}

export interface SectionInfo {
  name: SectionName | string;
  heading: string;
  text: string;
  line_count: number;
  word_count: number;
  confidence: number;
  present: boolean;
}

export interface ATSIssue {
  type: IssueSeverity;
  code: string;
  message: string;
  fix: string;
}

export interface ATSCheck {
  score: number;
  issues: ATSIssue[];
  checks_passed: number;
  checks_total: number;
  is_text_based: boolean;
  standard_headers_used: boolean;
  contact_info_found: boolean;
}

export interface KeywordGap {
  keyword: string;
  occurrences: number;
  importance: number;
  severity: Priority;
}

export interface SkillGap {
  skill: string;
  category: string;
  importance: Priority | string;
  mentioned_in_jd: number;
}

export interface WeakSection {
  section: string;
  score: number;
  issue: string;
  suggestion: string;
}

export interface GapAnalysis {
  missing_keywords: KeywordGap[];
  missing_skills: SkillGap[];
  weak_sections: WeakSection[];
  experience_gap: string | null;
  education_gap: string | null;
  terminology_mismatches: PartialSkillMatch[];
  coverage_ratio: number;
}

export interface Recommendation {
  priority: Priority;
  category: string;
  message: string;
  action: string;
  impact_score: number;
}

export interface NLPMetadata {
  resume_word_count: number;
  jd_word_count: number;
  resume_unique_tokens: number;
  jd_unique_tokens: number;
  resume_sentence_count: number;
  jd_sentence_count: number;
  processing_time_ms: number;
  models_used: string[];
  resume_extraction_method: ExtractionMethod;
  jd_extraction_method: ExtractionMethod;
  resume_is_scanned: boolean;
  jd_is_scanned: boolean;
  pipeline_stages_completed: string[];
  degraded_mode: boolean;
  warnings: string[];
}

export interface AnalysisResponse {
  id: string;
  timestamp: string;
  overall_score: number;
  grade: Grade;
  verdict: string;
  score_breakdown: ScoreBreakdown;
  skills_analysis: SkillsAnalysis;
  skill_details: SkillMatchDetails;
  keyword_analysis: KeywordAnalysis;
  entity_extraction: EntityExtraction;
  section_scores: Record<string, SectionScore>;
  sections: Record<string, SectionInfo>;
  ats_formatting: ATSCheck;
  gap_analysis: GapAnalysis;
  recommendations: Recommendation[];
  nlp_metadata: NLPMetadata;
  resume_filename: string;
  jd_filename: string;
  resume_preview: string;
  jd_preview: string;
  score_band: string;
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

export interface AnalysisListItem {
  id: string;
  timestamp: string;
  overall_score: number;
  grade: Grade;
  resume_filename: string;
  jd_filename: string;
  processing_time_ms: number;
  preview: string;
  top_matched_skills: string[];
  top_missing_skills: string[];
}

export interface HistoryPage {
  items: AnalysisListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface DeleteResponse {
  deleted: boolean;
  id: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Health / models                                                             */
/* -------------------------------------------------------------------------- */

export interface ModelStatus {
  name: string;
  loaded: boolean;
  loading: boolean;
  variant: string;
  error: string | null;
  load_time_ms: number | null;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "unhealthy" | string;
  version: string;
  environment: string;
  uptime_seconds: number;
  timestamp: string;
  models: Record<string, ModelStatus>;
  ocr_available: boolean;
  database_ok: boolean;
  analyses_count: number;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/** Standard error envelope returned by every non-2xx backend response. */
export interface ApiErrorBody {
  error: string;
  detail?: string | ValidationIssue[] | null;
  code?: string | null;
  request_id?: string | null;
  timestamp?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
  type?: string;
}

export type ApiErrorCode =
  | "validation_error"
  | "file_validation_error"
  | "unsupported_file_type"
  | "file_too_large"
  | "empty_file"
  | "corrupted_file"
  | "encrypted_file"
  | "pdf_extraction_error"
  | "insufficient_text"
  | "nlp_processing_error"
  | "analysis_timeout"
  | "rate_limit_exceeded"
  | "analysis_not_found"
  | "model_load_error"
  | "internal_error"
  | string;

/* -------------------------------------------------------------------------- */
/* UI-only types                                                               */
/* -------------------------------------------------------------------------- */

/** Labels shown by the analyze-page loader, keyed by backend stage name. */
export interface PipelineStage {
  key: string;
  label: string;
  description: string;
  /** Approximate completion percentage reported by the backend. */
  progress: number;
}

export type ToastKind = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  duration?: number;
}

export interface UploadSlot {
  file: File | null;
  error: string | null;
}
