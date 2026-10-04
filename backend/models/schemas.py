"""Pydantic schemas — the contract between the NLP core, the API and the UI.

The shapes defined here mirror the public API specification exactly
(``AnalysisResponse`` and friends). Intermediate pipeline artefacts
(:class:`ExtractedText`, :class:`CleanedText`, :class:`TokenizedText`,
:class:`ProcessedDocument`, ...) are modelled too so that every stage of the
pipeline is typed, serialisable and testable in isolation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


class Model(BaseModel):
    """Base model: forbid surprises, allow population by field name."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class Priority(str, Enum):
    """Recommendation priority."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IssueSeverity(str, Enum):
    """ATS formatting issue severity."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    SUCCESS = "success"


class ExtractionMethod(str, Enum):
    """How text was obtained from the uploaded document."""

    PDFPLUMBER = "pdfplumber"
    OCR_TESSERACT = "ocr_tesseract"
    HYBRID = "hybrid"
    PLAIN_TEXT = "plain_text"
    DOCX = "docx"
    FAILED = "failed"


# --------------------------------------------------------------------------- #
# Stage 1 — PDF extraction
# --------------------------------------------------------------------------- #
class ExtractedText(Model):
    """Result of stage 1: raw text pulled out of an uploaded document."""

    full_text: str = ""
    page_count: int = 0
    extraction_method: ExtractionMethod = ExtractionMethod.PDFPLUMBER
    is_scanned: bool = False
    ocr_attempted: bool = False
    ocr_available: bool = True
    tables_detected: int = 0
    images_detected: int = 0
    char_count: int = 0
    warnings: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Stage 2 — Cleaning
# --------------------------------------------------------------------------- #
class ExtractedContacts(Model):
    """Contact details lifted out of the document during cleaning."""

    emails: List[str] = Field(default_factory=list)
    urls: List[str] = Field(default_factory=list)
    phones: List[str] = Field(default_factory=list)


class CleanedText(Model):
    """Result of stage 2: normalised text plus harvested contact info."""

    cleaned_text: str = ""
    extracted_contacts: ExtractedContacts = Field(default_factory=ExtractedContacts)
    sentences: List[str] = Field(default_factory=list)
    lines: List[str] = Field(default_factory=list)
    word_count: int = 0
    char_count: int = 0


# --------------------------------------------------------------------------- #
# Stages 3-6 — Tokenization / POS / lemmatisation
# --------------------------------------------------------------------------- #
class TokenInfo(Model):
    """A single token with its linguistic annotations."""

    text: str
    lemma: str
    pos: str
    tag: str = ""
    is_stop: bool = False
    is_punct: bool = False
    is_alpha: bool = False
    is_digit: bool = False
    dep: str = ""


class TokenizedText(Model):
    """Result of stages 3-6."""

    tokens: List[TokenInfo] = Field(default_factory=list)
    sentences: List[str] = Field(default_factory=list)
    noun_chunks: List[str] = Field(default_factory=list)
    pos_distribution: Dict[str, int] = Field(default_factory=dict)
    word_count: int = 0
    unique_tokens: int = 0

    model_config = ConfigDict(arbitrary_types_allowed=True)


class NamedEntity(Model):
    """A spaCy named entity."""

    text: str
    label: str
    start: int = 0
    end: int = 0


class ProcessedDocument(Model):
    """The full output of :class:`~core.nlp_pipeline.NLPPipeline`."""

    raw_text: str = ""
    cleaned: CleanedText = Field(default_factory=CleanedText)
    tokenized: TokenizedText = Field(default_factory=TokenizedText)
    entities: List[NamedEntity] = Field(default_factory=list)
    filtered_tokens: List[str] = Field(default_factory=list)
    filtered_bigrams: List[str] = Field(default_factory=list)
    lemmas: List[str] = Field(default_factory=list)
    action_verbs: List[str] = Field(default_factory=list)
    quantified_achievements: int = 0
    processing_time_ms: float = 0.0


# --------------------------------------------------------------------------- #
# Stage 7/9 — Entities & sections
# --------------------------------------------------------------------------- #
class ResumeEntities(Model):
    """Structured entities extracted from a resume."""

    person: Optional[str] = None
    organizations: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    dates: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    degrees: List[str] = Field(default_factory=list)
    emails: List[str] = Field(default_factory=list)
    phones: List[str] = Field(default_factory=list)
    urls: List[str] = Field(default_factory=list)
    years_experience: Optional[float] = None
    education_level: Optional[str] = None
    job_titles: List[str] = Field(default_factory=list)


class JobDescriptionEntities(Model):
    """Structured entities extracted from a job description."""

    organization: Optional[str] = None
    location: Optional[str] = None
    job_title: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    soft_skills: List[str] = Field(default_factory=list)
    degree_requirement: Optional[str] = None
    experience_requirement: Optional[str] = None
    min_years_experience: Optional[float] = None
    salary_range: Optional[str] = None
    certifications: List[str] = Field(default_factory=list)


class EntityExtraction(Model):
    """Container used in the API response."""

    resume: ResumeEntities = Field(default_factory=ResumeEntities)
    job_description: JobDescriptionEntities = Field(default_factory=JobDescriptionEntities)


class SectionInfo(Model):
    """A parsed resume section."""

    name: str
    heading: str = ""
    text: str = ""
    line_count: int = 0
    word_count: int = 0
    confidence: float = 0.0
    present: bool = True


# --------------------------------------------------------------------------- #
# Stage 8 — Keywords
# --------------------------------------------------------------------------- #
class KeywordScore(Model):
    """A keyword/phrase with an importance score."""

    keyword: str
    score: float = 0.0
    method: str = "tfidf"
    count: int = 0


class JDKeyword(Model):
    """A job-description keyword, annotated with resume coverage."""

    keyword: str
    tfidf_score: float = 0.0
    found_in_resume: bool = False
    occurrences: int = 0
    importance: float = 0.0


class KeywordDensity(Model):
    """Fraction of document tokens covered by top keywords."""

    resume: float = 0.0
    jd: float = 0.0
    resume_status: str = "optimal"
    jd_status: str = "optimal"


class KeywordAnalysis(Model):
    """Keyword-level comparison surfaced in the API response."""

    top_jd_keywords: List[JDKeyword] = Field(default_factory=list)
    top_resume_keywords: List[JDKeyword] = Field(default_factory=list)
    common_keywords: List[str] = Field(default_factory=list)
    keyword_density: KeywordDensity = Field(default_factory=KeywordDensity)
    tfidf_cosine_similarity: float = 0.0
    rake_keywords: List[KeywordScore] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Stage 11 — Skill matching
# --------------------------------------------------------------------------- #
class PartialSkillMatch(Model):
    """A near-miss skill pair (e.g. "data analysis" vs "data analytics")."""

    resume: str
    jd: str
    similarity: float
    match_type: str = "fuzzy"


class SkillMatchResult(Model):
    """Output of the taxonomy-aware skill matcher."""

    matched: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    partial: List[PartialSkillMatch] = Field(default_factory=list)
    extra: List[str] = Field(default_factory=list)
    resume_skills: List[str] = Field(default_factory=list)
    jd_skills: List[str] = Field(default_factory=list)
    matched_by_category: Dict[str, List[str]] = Field(default_factory=dict)
    missing_by_category: Dict[str, List[str]] = Field(default_factory=dict)
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    score: float = 0.0


class SkillsAnalysis(Model):
    """Skill comparison as exposed by the API (spec-shaped)."""

    matched: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    partial: List[PartialSkillMatch] = Field(default_factory=list)
    extra: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #
class ScoreComponent(Model):
    """One weighted dimension of the overall score."""

    score: float = 0.0
    weight: float = 0.0
    weighted_score: float = 0.0
    detail: str = ""


class ScoreBreakdown(Model):
    """Five weighted dimensions — keys match the API spec."""

    keyword_match: ScoreComponent = Field(default_factory=ScoreComponent)
    semantic_similarity: ScoreComponent = Field(default_factory=ScoreComponent)
    skill_match: ScoreComponent = Field(default_factory=ScoreComponent)
    experience_relevance: ScoreComponent = Field(default_factory=ScoreComponent)
    education_match: ScoreComponent = Field(default_factory=ScoreComponent)


class ScoringResult(Model):
    """Overall multi-dimensional similarity score."""

    overall_score: float = 0.0
    breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    grade: str = "C"
    verdict: str = ""


class SectionScore(Model):
    """Per-section relevance score with feedback."""

    score: float = 0.0
    feedback: str = ""
    similarity: float = 0.0
    present: bool = True
    suggestions: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Stage 12 — Gap analysis, ATS check, recommendations
# --------------------------------------------------------------------------- #
class KeywordGap(Model):
    """A JD keyword missing from the resume."""

    keyword: str
    occurrences: int = 0
    importance: float = 0.0
    severity: Priority = Priority.MEDIUM


class SkillGap(Model):
    """A JD skill missing from the resume."""

    skill: str
    category: str = "other"
    importance: str = "medium"
    mentioned_in_jd: int = 0


class WeakSection(Model):
    """A resume section scoring below expectations."""

    section: str
    score: float = 0.0
    issue: str = ""
    suggestion: str = ""


class GapAnalysisResult(Model):
    """Structured gap analysis between resume and job description."""

    missing_keywords: List[KeywordGap] = Field(default_factory=list)
    missing_skills: List[SkillGap] = Field(default_factory=list)
    weak_sections: List[WeakSection] = Field(default_factory=list)
    experience_gap: Optional[str] = None
    education_gap: Optional[str] = None
    terminology_mismatches: List[PartialSkillMatch] = Field(default_factory=list)
    coverage_ratio: float = 0.0


class ATSIssue(Model):
    """A single ATS-compatibility finding."""

    type: IssueSeverity = IssueSeverity.INFO
    message: str
    code: str = ""
    fix: str = ""


class ATSCheck(Model):
    """ATS formatting/parseability report."""

    score: float = 0.0
    issues: List[ATSIssue] = Field(default_factory=list)
    checks_passed: int = 0
    checks_total: int = 0
    is_text_based: bool = True
    standard_headers_used: bool = True
    contact_info_found: bool = True


class Recommendation(Model):
    """An actionable, prioritised recommendation."""

    priority: Priority = Priority.MEDIUM
    category: str = "general"
    message: str
    action: str = ""
    impact_score: float = 0.0


# --------------------------------------------------------------------------- #
# NLP metadata
# --------------------------------------------------------------------------- #
class NLPMetadata(Model):
    """Processing statistics returned alongside the analysis."""

    resume_word_count: int = 0
    jd_word_count: int = 0
    resume_unique_tokens: int = 0
    jd_unique_tokens: int = 0
    resume_sentence_count: int = 0
    jd_sentence_count: int = 0
    resume_pages: int = 0
    jd_pages: int = 0
    processing_time_ms: float = 0.0
    models_used: List[str] = Field(default_factory=list)
    resume_extraction_method: str = ExtractionMethod.PDFPLUMBER.value
    jd_extraction_method: str = ExtractionMethod.PDFPLUMBER.value
    resume_is_scanned: bool = False
    jd_is_scanned: bool = False
    pipeline_stages_completed: List[str] = Field(default_factory=list)
    degraded_mode: bool = False
    warnings: List[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Top-level API response
# --------------------------------------------------------------------------- #
class AnalysisResponse(Model):
    """Complete analysis result — the shape consumed by the frontend."""

    id: str = Field(default_factory=_new_id)
    timestamp: datetime = Field(default_factory=_utcnow)
    overall_score: float = 0.0
    grade: str = "C"
    verdict: str = ""
    score_breakdown: ScoreBreakdown = Field(default_factory=ScoreBreakdown)
    skills_analysis: SkillsAnalysis = Field(default_factory=SkillsAnalysis)
    skill_details: SkillMatchResult = Field(default_factory=SkillMatchResult)
    keyword_analysis: KeywordAnalysis = Field(default_factory=KeywordAnalysis)
    entity_extraction: EntityExtraction = Field(default_factory=EntityExtraction)
    section_scores: Dict[str, SectionScore] = Field(default_factory=dict)
    sections: Dict[str, SectionInfo] = Field(default_factory=dict)
    ats_formatting: ATSCheck = Field(default_factory=ATSCheck)
    gap_analysis: GapAnalysisResult = Field(default_factory=GapAnalysisResult)
    recommendations: List[Recommendation] = Field(default_factory=list)
    nlp_metadata: NLPMetadata = Field(default_factory=NLPMetadata)
    resume_filename: str = "resume.pdf"
    jd_filename: str = "job_description.pdf"
    resume_preview: str = ""
    jd_preview: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def score_band(self) -> str:
        """Coarse band used by the UI to colour the gauge."""
        if self.overall_score >= 80:
            return "excellent"
        if self.overall_score >= 65:
            return "good"
        if self.overall_score >= 45:
            return "fair"
        return "poor"


class AnalysisListItem(Model):
    """Compact representation used by the history list endpoint."""

    id: str
    timestamp: datetime
    overall_score: float
    grade: str = "C"
    resume_filename: str = ""
    jd_filename: str = ""
    processing_time_ms: float = 0.0
    preview: str = ""
    top_matched_skills: List[str] = Field(default_factory=list)
    top_missing_skills: List[str] = Field(default_factory=list)


class HistoryPage(Model):
    """Paginated history response."""

    items: List[AnalysisListItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 0


class ModelStatus(Model):
    """Load state of a single NLP model."""

    name: str
    loaded: bool = False
    loading: bool = False
    variant: str = ""
    error: Optional[str] = None
    load_time_ms: Optional[float] = None


class HealthResponse(Model):
    """Health/monitoring payload."""

    status: str = "ok"
    version: str = "1.0.0"
    environment: str = "development"
    uptime_seconds: float = 0.0
    timestamp: datetime = Field(default_factory=_utcnow)
    models: Dict[str, ModelStatus] = Field(default_factory=dict)
    ocr_available: bool = False
    database_ok: bool = True
    analyses_count: int = 0


class ErrorResponse(Model):
    """Standard error envelope."""

    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=_utcnow)


class ValidationResult(Model):
    """Outcome of upload validation."""

    is_valid: bool = True
    error_message: Optional[str] = None
    filename: str = ""
    size_bytes: int = 0
    extension: str = ""
    content_type: str = ""
    is_encrypted: bool = False
    page_count: Optional[int] = None


class FileValidation(Model):
    """Validation results for both uploads, surfaced in errors."""

    resume: Optional[ValidationResult] = None
    job_description: Optional[ValidationResult] = None


class AnalysisRequestOptions(Model):
    """Optional tuning knobs accepted by the analyze endpoint."""

    weights: Optional[Dict[str, float]] = None
    top_keywords: Optional[int] = None
    include_section_text: bool = False
    persist: bool = True


class DeleteResponse(Model):
    """Response for destructive endpoints."""

    deleted: bool = True
    id: str
    message: str = "Analysis deleted"


class StatsResponse(Model):
    """Aggregate statistics for dashboards."""

    total_analyses: int = 0
    average_score: float = 0.0
    best_score: float = 0.0
    worst_score: float = 0.0
    score_distribution: Dict[str, int] = Field(default_factory=dict)
    most_common_missing_skills: List[Dict[str, Any]] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Internal (non-serialised) pipeline containers
# --------------------------------------------------------------------------- #
class DocumentAnalysis(Model):
    """Everything the orchestrator knows about one document."""

    source: str = "resume"
    filename: str = ""
    extracted: ExtractedText = Field(default_factory=ExtractedText)
    processed: ProcessedDocument = Field(default_factory=ProcessedDocument)
    sections: Dict[str, SectionInfo] = Field(default_factory=dict)
    keywords: List[KeywordScore] = Field(default_factory=list)
    rake_keywords: List[KeywordScore] = Field(default_factory=list)
    resume_entities: ResumeEntities = Field(default_factory=ResumeEntities)
    jd_entities: JobDescriptionEntities = Field(default_factory=JobDescriptionEntities)
    skills: List[str] = Field(default_factory=list)
    semantic_embedding: Optional[Any] = None

    model_config = ConfigDict(arbitrary_types_allowed=True)
