"""Analysis orchestration — runs all 14 pipeline stages end to end.

``AnalysisService.run_full_analysis`` is the single entry point used by the API.
It is deliberately synchronous (the endpoint dispatches it to a thread pool via
``run_in_threadpool``) because every stage is CPU-bound and the spaCy / scikit-learn
objects are not coroutine-friendly.

Pipeline order
--------------
1.  PDF extraction (+ OCR fallback)          :class:`~core.pdf_extractor.PDFExtractor`
2.  Text cleaning & normalisation            :class:`~core.text_cleaner.TextCleaner`
3.  Tokenization                             :class:`~core.tokenizer.Tokenizer`
4.  Stop-word removal                        :class:`~core.nlp_pipeline.NLPPipeline`
5.  Lemmatization                            ````
6.  POS tagging                              ````
7.  Named entity recognition                 :class:`~core.entity_extractor.EntityExtractor`
8.  Section parsing                          :class:`~core.section_parser.SectionParser`
9.  Keyword extraction (TF-IDF + RAKE + TextRank)  :class:`~core.keyword_extractor.KeywordExtractor`
10. Skill taxonomy matching                  :class:`~core.skill_matcher.SkillMatcher`
11. Semantic similarity (BERT / LSA)         :class:`~core.semantic_analyzer.SemanticAnalyzer`
12. Multi-dimensional scoring                :class:`~core.similarity_engine.SimilarityEngine`
13. Gap analysis                             :class:`~core.gap_analyzer.GapAnalyzer`
14. Recommendations + ATS check              :class:`~core.report_generator.ReportGenerator`
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple

from config import settings
from core.entity_extractor import EntityExtractor
from core.gap_analyzer import GapAnalyzer
from core.keyword_extractor import KeywordExtractor
from core.nlp_pipeline import NLPPipeline
from core.pdf_extractor import PDFExtractor
from core.report_generator import ReportGenerator
from core.section_parser import SectionParser
from core.semantic_analyzer import SemanticAnalyzer
from core.similarity_engine import SimilarityEngine
from core.skill_matcher import SkillMatcher
from models.schemas import (
    AnalysisResponse,
    DocumentAnalysis,
    ExtractedText,
    KeywordAnalysis,
    KeywordDensity,
    NLPMetadata,
    ProcessedDocument,
    SkillsAnalysis,
)
from services.cache_service import ModelRegistry, model_registry
from utils.exceptions import ATSError, InsufficientTextError, NLPProcessingError
from utils.logger import get_logger, log_stage
from utils.text_utils import clamp, dedupe_preserve_order, truncate

logger = get_logger(__name__)

ProgressCallback = Callable[[str, float], None]


class AnalysisService:
    """Coordinates every NLP component to produce one :class:`AnalysisResponse`."""

    def __init__(
        self,
        registry: Optional[ModelRegistry] = None,
        pdf_extractor: Optional[PDFExtractor] = None,
        section_parser: Optional[SectionParser] = None,
        keyword_extractor: Optional[KeywordExtractor] = None,
        semantic_analyzer: Optional[SemanticAnalyzer] = None,
        entity_extractor: Optional[EntityExtractor] = None,
        skill_matcher: Optional[SkillMatcher] = None,
        similarity_engine: Optional[SimilarityEngine] = None,
        gap_analyzer: Optional[GapAnalyzer] = None,
        report_generator: Optional[ReportGenerator] = None,
    ) -> None:
        self.registry = registry or model_registry
        self.pdf_extractor = pdf_extractor or PDFExtractor()
        self.section_parser = section_parser or SectionParser()
        self.report_generator = report_generator or ReportGenerator()

        stop_words, protected = self._load_stop_words()
        self.stop_words: List[str] = sorted(stop_words)
        self.protected_terms: List[str] = sorted(protected)

        nlp = self.registry.get_nlp()
        self.nlp_pipeline = NLPPipeline(
            nlp, custom_stop_words=stop_words, protected_terms=protected
        )
        self.keyword_extractor = keyword_extractor or KeywordExtractor(
            stop_words=self.stop_words, protected_terms=self.protected_terms
        )
        self.semantic_analyzer = semantic_analyzer or SemanticAnalyzer(
            registry=self.registry, stop_words=self.stop_words
        )
        self.entity_extractor = entity_extractor or EntityExtractor(self.nlp_pipeline)
        self.skill_matcher = skill_matcher or SkillMatcher(
            entity_extractor=self.entity_extractor, semantic_analyzer=self.semantic_analyzer
        )
        self.similarity_engine = similarity_engine or SimilarityEngine(
            semantic_analyzer=self.semantic_analyzer, entity_extractor=self.entity_extractor
        )
        self.gap_analyzer = gap_analyzer or GapAnalyzer(entity_extractor=self.entity_extractor)

    # ------------------------------------------------------------------ #
    def _load_stop_words(self) -> Tuple[set, set]:
        """Domain stop words + protected technical terms from the data files."""
        data = self.registry.stop_words_data
        stop: set[str] = set()
        for key in ("resume_boilerplate", "jd_boilerplate", "filler_verbs", "weak_modifiers", "noise_tokens"):
            stop.update(str(w).strip().lower() for w in data.get(key, []) if w)
        protected = {str(t).strip().lower() for t in data.get("protected_terms", []) if t}
        # Protected terms always win over stop words.
        stop -= protected
        return stop, protected

    # ------------------------------------------------------------------ #
    # Orchestration
    # ------------------------------------------------------------------ #
    def run_full_analysis(
        self,
        resume_bytes: bytes,
        jd_bytes: bytes,
        *,
        resume_filename: str = "resume.pdf",
        jd_filename: str = "job_description.pdf",
        resume_size_bytes: Optional[int] = None,
        jd_size_bytes: Optional[int] = None,
        weights: Optional[Dict[str, float]] = None,
        top_keywords: Optional[int] = None,
        include_section_text: bool = False,
        progress: Optional[ProgressCallback] = None,
    ) -> AnalysisResponse:
        """Execute the complete analysis and return the API-shaped result."""
        started = time.perf_counter()
        stages: List[str] = []
        warnings: List[str] = []
        top_n = top_keywords or settings.top_keywords

        def report(stage: str, pct: float) -> None:
            stages.append(stage)
            log_stage(logger, stage, progress=pct)
            if progress:
                try:
                    progress(stage, pct)
                except Exception as exc:  # noqa: BLE001 - progress is best effort
                    logger.debug("progress_callback_failed", extra={"error": str(exc)})

        try:
            # 1. Extraction ------------------------------------------------- #
            report("extracting_text", 0.05)
            resume_doc = self._extract(resume_bytes, resume_filename)
            jd_doc = self._extract(jd_bytes, jd_filename)
            warnings.extend(resume_doc.warnings + jd_doc.warnings)

            # 2-7. Cleaning / tokens / stop words / lemmas / POS / NER ------- #
            report("running_nlp_pipeline", 0.25)
            resume_processed = self.nlp_pipeline.process(
                resume_doc.full_text, source="resume", is_ocr_text=resume_doc.is_scanned
            )
            jd_processed = self.nlp_pipeline.process(
                jd_doc.full_text, source="job_description", is_ocr_text=jd_doc.is_scanned
            )

            # 8. Section parsing -------------------------------------------- #
            report("parsing_sections", 0.40)
            resume_sections = self.section_parser.parse_sections(
                resume_processed.cleaned.cleaned_text, source="resume"
            )
            jd_sections = self.section_parser.parse_sections(
                jd_processed.cleaned.cleaned_text, source="job_description"
            )

            # 7b. Entity extraction ----------------------------------------- #
            report("extracting_entities", 0.50)
            resume_entities = self.entity_extractor.extract_resume_entities(
                resume_processed.cleaned.cleaned_text,
                self._doc_for(resume_processed),
                resume_processed.cleaned,
                resume_sections,
            )
            jd_entities = self.entity_extractor.extract_jd_entities(
                jd_processed.cleaned.cleaned_text, self._doc_for(jd_processed)
            )

            # 9. Keyword extraction & comparison ----------------------------- #
            report("extracting_keywords", 0.62)
            tfidf_cosine, top_jd_keywords, top_resume_keywords, common_keywords = (
                self.keyword_extractor.compare(
                    resume_processed.cleaned.cleaned_text,
                    jd_processed.cleaned.cleaned_text,
                    top_n=top_n,
                    stopwords=self.stop_words,
                )
            )
            resume_density = self.keyword_extractor.keyword_density(
                resume_processed.cleaned.cleaned_text, top_resume_keywords
            )
            jd_density = self.keyword_extractor.keyword_density(
                jd_processed.cleaned.cleaned_text, top_jd_keywords
            )
            keyword_analysis = KeywordAnalysis(
                top_jd_keywords=top_jd_keywords,
                top_resume_keywords=top_resume_keywords,
                common_keywords=common_keywords,
                keyword_density=KeywordDensity(
                    resume=resume_density.resume,
                    jd=jd_density.jd,
                    resume_status=resume_density.resume_status,
                    jd_status=jd_density.jd_status,
                ),
                tfidf_cosine_similarity=round(tfidf_cosine, 6),
                rake_keywords=self.keyword_extractor.extract_rake_keywords(
                    jd_processed.cleaned.cleaned_text, top_n=settings.rake_top_keywords
                ),
            )

            # 10. Skill matching -------------------------------------------- #
            report("matching_skills", 0.72)
            resume_skills = resume_entities.skills or self.entity_extractor.extract_skills(
                resume_processed.cleaned.cleaned_text
            )
            jd_skills = dedupe_preserve_order(
                jd_entities.required_skills + jd_entities.preferred_skills
            ) or self.entity_extractor.extract_skills(jd_processed.cleaned.cleaned_text)
            skill_match = self.skill_matcher.match_skills(resume_skills, jd_skills)

            # 11. Semantic similarity --------------------------------------- #
            report("computing_semantic_similarity", 0.80)
            semantic_variant = self.semantic_analyzer.variant
            section_text_map = {
                name: info.text for name, info in resume_sections.items() if info.text.strip()
            }
            section_similarities = self.semantic_analyzer.compute_section_similarities(
                section_text_map, jd_processed.cleaned.cleaned_text
            )
            semantic_similarity = self.semantic_analyzer.compute_semantic_similarity(
                resume_processed.cleaned.cleaned_text, jd_processed.cleaned.cleaned_text
            )

            # 12. Scoring ---------------------------------------------------- #
            report("computing_scores", 0.88)
            scoring = self.similarity_engine.compute_full_score(
                tfidf_cosine=tfidf_cosine,
                jd_keywords=top_jd_keywords,
                semantic_similarity=semantic_similarity,
                semantic_variant=semantic_variant,
                skill_match=skill_match,
                resume_entities=resume_entities,
                jd_entities=jd_entities,
                section_similarities=section_similarities,
                action_verbs=resume_processed.action_verbs,
                quantified_achievements=resume_processed.quantified_achievements,
                has_education_section="education" in resume_sections,
                weights=weights,
            )
            section_scores = self.similarity_engine.section_scores(
                section_similarities=section_similarities,
                sections=resume_sections,
                skill_match=skill_match,
                resume_entities=resume_entities,
                jd_entities=jd_entities,
                quantified_achievements=resume_processed.quantified_achievements,
            )

            # 13. Gap analysis ---------------------------------------------- #
            report("analyzing_gaps", 0.93)
            gap_analysis = self.gap_analyzer.analyze_gaps(
                resume_entities=resume_entities,
                jd_entities=jd_entities,
                skill_match=skill_match,
                keyword_analysis=keyword_analysis,
                section_scores=section_scores,
                detected_sections=self.section_parser.detected_section_names(resume_sections),
                quantified_achievements=resume_processed.quantified_achievements,
                action_verbs=resume_processed.action_verbs,
                top_n_keywords=top_n,
            )

            # 14. ATS check + recommendations -------------------------------- #
            report("generating_report", 0.97)
            ats_check = self.report_generator.generate_ats_check(
                raw_text=resume_doc.full_text,
                extracted=resume_doc,
                sections=self.section_parser.detected_section_names(resume_sections),
                emails=resume_entities.emails,
                phones=resume_entities.phones,
                file_size_bytes=resume_size_bytes if resume_size_bytes is not None else len(resume_bytes),
                keyword_density=keyword_analysis.keyword_density.resume,
                word_count=resume_processed.cleaned.word_count,
            )

            elapsed_ms = (time.perf_counter() - started) * 1000
            metadata = NLPMetadata(
                resume_word_count=resume_processed.cleaned.word_count,
                jd_word_count=jd_processed.cleaned.word_count,
                resume_unique_tokens=resume_processed.tokenized.unique_tokens,
                jd_unique_tokens=jd_processed.tokenized.unique_tokens,
                resume_sentence_count=len(resume_processed.cleaned.sentences),
                jd_sentence_count=len(jd_processed.cleaned.sentences),
                processing_time_ms=round(elapsed_ms, 1),
                models_used=self.registry.models_used(),
                resume_extraction_method=resume_doc.extraction_method.value,
                jd_extraction_method=jd_doc.extraction_method.value,
                resume_is_scanned=resume_doc.is_scanned,
                jd_is_scanned=jd_doc.is_scanned,
                pipeline_stages_completed=dedupe_preserve_order(stages),
                degraded_mode=self.registry.degraded,
                warnings=dedupe_preserve_order(warnings),
            )

            recommendations = self.report_generator.generate_recommendations(
                gap_analysis=gap_analysis,
                breakdown=scoring.breakdown,
                skill_match=skill_match,
                keyword_analysis=keyword_analysis,
                section_scores=section_scores,
                ats_check=ats_check,
                resume_entities=resume_entities,
                jd_entities=jd_entities,
                metadata=metadata,
                quantified_achievements=resume_processed.quantified_achievements,
                action_verbs=resume_processed.action_verbs,
            )

            sections_payload: Dict[str, Any] = {}
            for name, info in resume_sections.items():
                sections_payload[name] = info.model_copy(
                    update={"text": info.text if include_section_text else truncate(info.text, 240)}
                )
            for name, info in jd_sections.items():
                sections_payload[f"jd_{name}"] = info.model_copy(
                    update={"text": info.text if include_section_text else truncate(info.text, 240)}
                )

            response = AnalysisResponse(
                id=str(uuid.uuid4()),
                overall_score=scoring.overall_score,
                grade=scoring.grade,
                verdict=scoring.verdict,
                score_breakdown=scoring.breakdown,
                skills_analysis=SkillsAnalysis(
                    matched=skill_match.matched,
                    missing=skill_match.missing,
                    partial=skill_match.partial,
                    extra=skill_match.extra,
                ),
                skill_details=skill_match,
                keyword_analysis=keyword_analysis,
                entity_extraction={  # type: ignore[arg-type]
                    "resume": resume_entities,
                    "job_description": jd_entities,
                },
                section_scores=section_scores,
                sections=sections_payload,
                ats_formatting=ats_check,
                gap_analysis=gap_analysis,
                recommendations=recommendations,
                nlp_metadata=metadata,
                resume_filename=resume_filename,
                jd_filename=jd_filename,
                resume_preview=truncate(resume_processed.cleaned.cleaned_text, 400),
                jd_preview=truncate(jd_processed.cleaned.cleaned_text, 400),
            )

            logger.info(
                "analysis_completed",
                extra={
                    "id": response.id,
                    "score": response.overall_score,
                    "grade": response.grade,
                    "elapsed_ms": round(elapsed_ms, 1),
                    "stages": len(stages),
                    "degraded": self.registry.degraded,
                    "recommendations": len(recommendations),
                },
            )
            report("complete", 1.0)
            return response

        except ATSError:
            # Typed domain errors (extraction, insufficient text, ...) already
            # carry the correct HTTP status — let the middleware handle them.
            raise
        except Exception as exc:  # noqa: BLE001 - translate to a typed error
            logger.error(
                "analysis_failed",
                extra={"error": str(exc), "stage": stages[-1] if stages else "unknown"},
                exc_info=True,
            )
            raise NLPProcessingError(
                "The analysis could not be completed.",
                detail=f"{type(exc).__name__}: {exc}",
                context={"stage": stages[-1] if stages else "unknown"},
            ) from exc

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _extract(self, file_bytes: bytes, filename: str) -> ExtractedText:
        """Stage 1 — extract text, enforcing the minimum-length contract."""
        extracted = self.pdf_extractor.extract(file_bytes, filename)
        chars = len(extracted.full_text.strip())
        if chars < settings.min_extracted_chars:
            logger.warning(
                "insufficient_text",
                extra={"file_name": filename, "chars": chars,
                       "minimum": settings.min_extracted_chars,
                       "is_scanned": extracted.is_scanned},
            )
            raise InsufficientTextError(
                f"Only {chars} readable character(s) were found in '{filename}'. "
                "The document may be an image-only scan without OCR support available.",
                context={
                    "filename": filename,
                    "characters_found": chars,
                    "minimum_required": settings.min_extracted_chars,
                    "is_scanned": extracted.is_scanned,
                    "extraction_method": extracted.extraction_method.value,
                },
            )
        return extracted

    def _doc_for(self, processed: ProcessedDocument) -> Any:
        """Rebuild the spaCy ``Doc`` so NER can reuse the annotated tokens."""
        try:
            return self.nlp_pipeline.tokenizer.make_doc(processed.cleaned.cleaned_text)
        except Exception as exc:  # noqa: BLE001 - entity extraction can proceed without it
            logger.debug("doc_rebuild_failed", extra={"error": str(exc)})
            return None


# --------------------------------------------------------------------------- #
# Singleton
# --------------------------------------------------------------------------- #
_service: Optional[AnalysisService] = None


def get_analysis_service() -> AnalysisService:
    """Return the process-wide analysis service (built on first use)."""
    global _service
    if _service is None:
        started = time.perf_counter()
        _service = AnalysisService()
        logger.info(
            "analysis_service_ready",
            extra={"build_time_ms": round((time.perf_counter() - started) * 1000, 1)},
        )
    return _service


def reset_analysis_service() -> None:
    """Drop the cached service (used by tests after a registry reset)."""
    global _service
    _service = None


__all__ = ["AnalysisService", "get_analysis_service", "reset_analysis_service"]
