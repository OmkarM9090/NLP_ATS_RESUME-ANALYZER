"""Stage 12 — multi-dimensional similarity scoring.

``overall_score`` is the weighted sum of five independently computed
dimensions (weights come from :mod:`config` and match the product spec):

================================ =========  =====================================
Dimension                          weight    How it is computed
================================ =========  =====================================
keyword_match                        0.25    TF-IDF cosine (calibrated) blended
                                             with JD keyword coverage
semantic_similarity                  0.30    BERT/LSA document embedding cosine
                                             (calibrated per encoder variant)
skill_match                          0.25    Taxonomy matcher score (exact +
                                             fuzzy + semantic skill matches)
experience_relevance                 0.10    Years-of-experience vs requirement,
                                             job-title overlap and experience
                                             section similarity
education_match                      0.10    Degree level (and field) vs the
                                             requirement stated in the JD
================================ =========  =====================================

Raw cosine similarities are *calibrated* before scoring: a 0.12 TF-IDF cosine
between a resume and a JD is a genuinely strong match, so both dimensions pass
through ``1 - exp(-x / tau)`` with encoder-specific ``tau`` values. This keeps
scores comparable across the transformer and offline-LSA paths and keeps the
final number in a range humans recognise from real ATS tools.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

from config import settings
from core.report_generator import NON_CONTENT_SECTIONS
from models.schemas import (
    JDKeyword,
    ResumeEntities,
    JobDescriptionEntities,
    ScoreBreakdown,
    ScoreComponent,
    ScoringResult,
    SectionScore,
    SkillMatchResult,
)
from utils.logger import get_logger
from utils.text_utils import clamp, safe_ratio

logger = get_logger(__name__)

EDUCATION_RANK: Dict[str, int] = {
    "high_school": 0,
    "certification": 1,
    "associate": 2,
    "bachelor": 3,
    "master": 4,
    "phd": 5,
}
EDUCATION_LABEL: Dict[str, str] = {
    "high_school": "High school",
    "certification": "Certification",
    "associate": "Associate degree",
    "bachelor": "Bachelor's degree",
    "master": "Master's degree",
    "phd": "Doctorate (PhD)",
}

GRADE_BANDS: Tuple[Tuple[float, str], ...] = (
    (85.0, "A"), (70.0, "B"), (55.0, "C"), (40.0, "D"), (0.0, "F"),
)


def calibrate(value: float, tau: float) -> float:
    """Map a raw cosine similarity onto a 0-1 match strength."""
    if value <= 0 or tau <= 0:
        return 0.0
    return clamp(1.0 - math.exp(-value / tau), 0.0, 1.0)


def grade_for(score: float) -> str:
    """Letter grade for a 0-100 score."""
    for threshold, grade in GRADE_BANDS:
        if score >= threshold:
            return grade
    return "F"


class SimilarityEngine:
    """Combines every signal into the final weighted score."""

    def __init__(
        self,
        semantic_analyzer: Optional[Any] = None,
        entity_extractor: Optional[Any] = None,
        weights: Optional[Dict[str, float]] = None,
    ) -> None:
        self.semantic = semantic_analyzer
        self.entity_extractor = entity_extractor
        self.weights = self._normalize_weights(weights or settings.score_weights)

    @staticmethod
    def _normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
        total = sum(max(0.0, float(w)) for w in weights.values())
        if total <= 0:
            return {key: 1.0 / len(weights) for key in weights}
        return {key: max(0.0, float(value)) / total for key, value in weights.items()}

    # ------------------------------------------------------------------ #
    # Dimension 1 — keyword match
    # ------------------------------------------------------------------ #
    def compute_keyword_score(
        self, tfidf_cosine: float, jd_keywords: Sequence[JDKeyword], top_n: int = 25
    ) -> Tuple[float, str]:
        """Blend calibrated TF-IDF cosine with JD keyword coverage."""
        considered = list(jd_keywords)[:top_n]
        if considered:
            coverage = safe_ratio(
                sum(1 for k in considered if k.found_in_resume), len(considered)
            )
        else:
            coverage = 0.0
        calibrated = calibrate(tfidf_cosine, settings.keyword_cosine_tau)
        score = clamp(100.0 * (0.45 * calibrated + 0.55 * coverage), 0.0, 100.0)
        detail = (
            f"TF-IDF cosine {tfidf_cosine:.3f} (calibrated {calibrated:.2f}); "
            f"{sum(1 for k in considered if k.found_in_resume)}/{len(considered)} "
            "top job-description keywords present in the resume."
        )
        return round(score, 2), detail

    # ------------------------------------------------------------------ #
    # Dimension 2 — semantic similarity
    # ------------------------------------------------------------------ #
    def compute_semantic_score(self, raw_similarity: float, variant: str = "transformer") -> Tuple[float, str]:
        tau = (
            settings.semantic_tau_transformer
            if variant == "transformer"
            else settings.semantic_tau_lsa
        )
        calibrated = calibrate(raw_similarity, tau)
        score = clamp(100.0 * calibrated, 0.0, 100.0)
        detail = (
            f"{variant} embedding cosine {raw_similarity:.3f} "
            f"calibrated to {calibrated:.2f} (tau={tau})."
        )
        return round(score, 2), detail

    # ------------------------------------------------------------------ #
    # Dimension 3 — skills
    # ------------------------------------------------------------------ #
    def compute_skill_score(self, skill_match: SkillMatchResult) -> Tuple[float, str]:
        detail = (
            f"{len(skill_match.matched)} matched, {len(skill_match.partial)} partial, "
            f"{len(skill_match.missing)} missing of {len(skill_match.jd_skills)} "
            f"job-description skills (recall {skill_match.recall:.2f}, F1 {skill_match.f1:.2f})."
        )
        return round(clamp(skill_match.score, 0.0, 100.0), 2), detail

    # ------------------------------------------------------------------ #
    # Dimension 4 — experience relevance
    # ------------------------------------------------------------------ #
    def compute_experience_score(
        self,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        section_similarities: Optional[Dict[str, float]] = None,
        action_verbs: Sequence[str] = (),
        quantified_achievements: int = 0,
    ) -> Tuple[float, str]:
        """Years-of-experience fit + role/context relevance."""
        section_similarities = section_similarities or {}
        years = resume_entities.years_experience or 0.0
        required = jd_entities.min_years_experience

        if required and required > 0:
            ratio = years / required
            years_score = clamp(100.0 * ratio, 0.0, 100.0)
            if ratio >= 1.0:
                # Exceeding the bar is worth a little more than exactly meeting it.
                years_score = clamp(100.0 + min(10.0, (ratio - 1.0) * 20.0), 0.0, 100.0)
            years_detail = f"{years:.1f} years detected vs {required:g}+ required"
        else:
            years_score = clamp(45.0 + years * 7.0, 0.0, 100.0)
            years_detail = (
                f"{years:.1f} years detected; the posting states no explicit minimum"
            )

        title_score = self._title_overlap(resume_entities.job_titles, jd_entities.job_title)
        context_score = clamp(100.0 * section_similarities.get("experience", 0.0), 0.0, 100.0)

        # Writing-quality signals: action verbs and quantified achievements.
        quality = clamp(len(action_verbs) * 4.0 + min(quantified_achievements, 10) * 4.0, 0.0, 40.0)

        score = 0.55 * years_score + 0.20 * title_score + 0.15 * context_score + 0.10 * (quality / 0.4)
        score = clamp(score, 0.0, 100.0)
        detail = (
            f"{years_detail}; job-title overlap {title_score:.0f}/100; "
            f"experience-section similarity {context_score:.0f}/100; "
            f"{len(action_verbs)} action verbs and {quantified_achievements} quantified results."
        )
        return round(score, 2), detail

    def _title_overlap(self, resume_titles: Sequence[str], jd_title: Optional[str]) -> float:
        """Token-overlap score between resume job titles and the JD title."""
        if not jd_title:
            return 60.0 if resume_titles else 20.0
        jd_tokens = {t for t in jd_title.lower().replace("-", " ").split() if len(t) > 2}
        if not jd_tokens:
            return 50.0
        best = 0.0
        for title in resume_titles:
            tokens = {t for t in title.lower().replace("-", " ").split() if len(t) > 2}
            if not tokens:
                continue
            overlap = len(jd_tokens & tokens) / max(1, len(jd_tokens))
            best = max(best, overlap)
        return clamp(100.0 * best, 0.0, 100.0)

    # ------------------------------------------------------------------ #
    # Dimension 5 — education
    # ------------------------------------------------------------------ #
    def compute_education_score(
        self,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        has_education_section: bool = False,
    ) -> Tuple[float, str]:
        """Compare degree levels (and field of study) against the requirement."""
        resume_level = resume_entities.education_level
        required_level = self.required_education_level(jd_entities)

        resume_rank = EDUCATION_RANK.get(resume_level or "", -1)
        required_rank = EDUCATION_RANK.get(required_level or "", -1)

        if required_rank < 0:
            if resume_rank >= 0:
                score = 90.0
                detail = (
                    f"{EDUCATION_LABEL.get(resume_level or '', 'Education')} detected; "
                    "the posting states no formal education requirement."
                )
            elif has_education_section:
                score = 70.0
                detail = "Education section present but no degree level could be parsed."
            else:
                score = 45.0
                detail = "No education section or degree detected, and none required."
            return round(score, 2), detail

        if resume_rank < 0:
            return round(25.0, 2), (
                f"The posting requires {EDUCATION_LABEL.get(required_level or '', required_level)} "
                "but no degree was detected on the resume."
            )

        field_match = self._field_of_study_match(resume_entities, jd_entities)
        if resume_rank >= required_rank:
            score = 100.0 if field_match in (True, None) else 88.0
            detail = (
                f"Meets/exceeds the requirement "
                f"({EDUCATION_LABEL.get(resume_level or '', resume_level)} vs "
                f"{EDUCATION_LABEL.get(required_level or '', required_level)} required)"
                + ("" if field_match is not False else ", though the field of study differs")
                + "."
            )
        elif resume_rank == required_rank - 1:
            score = 72.0 if field_match is not False else 62.0
            detail = (
                f"One level below the stated requirement "
                f"({EDUCATION_LABEL.get(resume_level or '', resume_level)} vs "
                f"{EDUCATION_LABEL.get(required_level or '', required_level)} required)."
            )
        else:
            score = 40.0
            detail = (
                f"Below the stated requirement "
                f"({EDUCATION_LABEL.get(resume_level or '', resume_level)} vs "
                f"{EDUCATION_LABEL.get(required_level or '', required_level)} required)."
            )
        return round(clamp(score, 0.0, 100.0), 2), detail

    def required_education_level(self, jd_entities: JobDescriptionEntities) -> Optional[str]:
        """Highest degree level demanded by the job description."""
        phrase = (jd_entities.degree_requirement or "").lower()
        if not phrase:
            return None
        found: List[str] = []
        if re_search_any(phrase, ("phd", "ph.d", "doctorate", "doctoral")):
            found.append("phd")
        if re_search_any(phrase, ("master", "m.s.", "msc", "m.sc", "mba", "m.eng", "postgraduate")):
            found.append("master")
        if re_search_any(phrase, ("bachelor", "b.s.", "bsc", "b.sc", "b.tech", "b.eng", "undergraduate", "degree")):
            found.append("bachelor")
        if re_search_any(phrase, ("associate degree", "diploma", "hnd")):
            found.append("associate")
        if not found:
            return None
        return max(found, key=lambda level: EDUCATION_RANK[level])

    @staticmethod
    def _field_of_study_match(
        resume_entities: ResumeEntities, jd_entities: JobDescriptionEntities
    ) -> Optional[bool]:
        """``True``/``False`` when both sides state a field, else ``None``."""
        jd_phrase = (jd_entities.degree_requirement or "").lower()
        if not jd_phrase:
            return None
        jd_fields = [field for field in _DEGREE_FIELD_TERMS if field in jd_phrase]
        if not jd_fields:
            return None
        resume_text = " ".join(resume_entities.degrees).lower()
        if not resume_text:
            return None
        return any(field in resume_text for field in jd_fields)

    # ------------------------------------------------------------------ #
    # Aggregation
    # ------------------------------------------------------------------ #
    def compute_full_score(
        self,
        *,
        tfidf_cosine: float,
        jd_keywords: Sequence[JDKeyword],
        semantic_similarity: float,
        semantic_variant: str,
        skill_match: SkillMatchResult,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        section_similarities: Optional[Dict[str, float]] = None,
        action_verbs: Sequence[str] = (),
        quantified_achievements: int = 0,
        has_education_section: bool = False,
        weights: Optional[Dict[str, float]] = None,
    ) -> ScoringResult:
        """Compute all five dimensions and the weighted overall score."""
        active_weights = self._normalize_weights(weights) if weights else self.weights

        keyword_score, keyword_detail = self.compute_keyword_score(tfidf_cosine, jd_keywords)
        semantic_score, semantic_detail = self.compute_semantic_score(
            semantic_similarity, semantic_variant
        )
        skill_score, skill_detail = self.compute_skill_score(skill_match)
        experience_score, experience_detail = self.compute_experience_score(
            resume_entities, jd_entities, section_similarities,
            action_verbs, quantified_achievements,
        )
        education_score, education_detail = self.compute_education_score(
            resume_entities, jd_entities, has_education_section
        )

        components = {
            "keyword_match": (keyword_score, keyword_detail),
            "semantic_similarity": (semantic_score, semantic_detail),
            "skill_match": (skill_score, skill_detail),
            "experience_relevance": (experience_score, experience_detail),
            "education_match": (education_score, education_detail),
        }

        overall = 0.0
        built: Dict[str, ScoreComponent] = {}
        for key, (score, detail) in components.items():
            weight = float(active_weights.get(key, 0.0))
            weighted = score * weight
            overall += weighted
            built[key] = ScoreComponent(
                score=round(score, 2), weight=round(weight, 4),
                weighted_score=round(weighted, 2), detail=detail,
            )

        overall = round(clamp(overall, 0.0, 100.0), 1)
        breakdown = ScoreBreakdown(**built)
        grade = grade_for(overall)
        result = ScoringResult(
            overall_score=overall, breakdown=breakdown, grade=grade,
            verdict=self.verdict(overall, skill_match, resume_entities, jd_entities),
        )
        logger.info(
            "score_computed",
            extra={
                "overall": overall,
                "grade": grade,
                **{k: round(v.score, 1) for k, v in built.items()},
            },
        )
        return result

    # ------------------------------------------------------------------ #
    @staticmethod
    def verdict(
        overall: float,
        skill_match: SkillMatchResult,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
    ) -> str:
        """One-sentence human summary of the match."""
        if overall >= 85:
            band = "Exceptional match — this resume closely mirrors what the posting asks for."
        elif overall >= 70:
            band = "Strong match — the resume covers most requirements with a few gaps."
        elif overall >= 55:
            band = "Moderate match — relevant background, but several requirements are unaddressed."
        elif overall >= 40:
            band = "Weak match — significant gaps against the stated requirements."
        else:
            band = "Poor match — the resume and this job description barely overlap."

        extras: List[str] = []
        if skill_match.missing:
            shown = ", ".join(skill_match.missing[:3])
            extras.append(f"missing skills: {shown}")
        years = resume_entities.years_experience
        required = jd_entities.min_years_experience
        if years is not None and required:
            extras.append(f"experience {years:.0f}y vs {required:g}y required")
        suffix = f" ({'; '.join(extras)})." if extras else ""
        return f"{band}{suffix}"

    # ------------------------------------------------------------------ #
    def section_scores(
        self,
        section_similarities: Dict[str, float],
        sections: Dict[str, Any],
        skill_match: SkillMatchResult,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        quantified_achievements: int = 0,
    ) -> Dict[str, SectionScore]:
        """Per-section scores with tailored feedback for the results UI."""
        scores: Dict[str, SectionScore] = {}
        semantic_variant = getattr(self.semantic, "variant", "lsa") if self.semantic else "lsa"
        tau = (
            settings.semantic_tau_transformer
            if semantic_variant == "transformer"
            else settings.semantic_tau_lsa
        )

        for name, similarity in section_similarities.items():
            if name in NON_CONTENT_SECTIONS:
                # Contact/reference blocks carry no matching signal.
                continue
            info = sections.get(name)
            present = bool(info is not None and getattr(info, "text", "").strip())
            base = clamp(100.0 * calibrate(similarity, tau), 0.0, 100.0)
            score = base
            feedback = ""
            suggestions: List[str] = []

            if name == "skills":
                skill_component = clamp(skill_match.score, 0.0, 100.0)
                score = clamp(0.4 * base + 0.6 * skill_component, 0.0, 100.0)
                if skill_match.missing:
                    feedback = (
                        f"{len(skill_match.matched)} of {len(skill_match.jd_skills)} required "
                        f"skills matched; {len(skill_match.missing)} missing."
                    )
                    suggestions.append(
                        "Add the missing skills you genuinely have: "
                        + ", ".join(skill_match.missing[:5])
                        + "."
                    )
                else:
                    feedback = "Strong technical skills match against this job description."
            elif name == "experience":
                if quantified_achievements < 3:
                    suggestions.append(
                        "Quantify more achievements (%, $, users, latency) — ATS reviewers "
                        "and recruiters both scan for numbers."
                    )
                    score = clamp(score * 0.9, 0.0, 100.0)
                feedback = (
                    f"{quantified_achievements} quantified result(s) detected. "
                    + ("Experience section aligns well with the role."
                       if base >= 60 else "Experience wording diverges from the job description.")
                )
            elif name == "education":
                edu_score, edu_detail = self.compute_education_score(
                    resume_entities, jd_entities, present
                )
                score = clamp(0.5 * base + 0.5 * edu_score, 0.0, 100.0)
                feedback = edu_detail
            elif name == "summary":
                if not present:
                    score = 0.0
                    feedback = "No professional summary section was detected."
                    suggestions.append(
                        "Add a 2-3 line summary that mirrors the job title and its top 3 skills."
                    )
                else:
                    feedback = (
                        "Summary aligns with the role." if base >= 55
                        else "Summary could be re-targeted to this role's language."
                    )
                    if base < 55:
                        suggestions.append(
                            "Mirror the job title and top keywords from the posting in your summary."
                        )
            elif name == "projects":
                feedback = (
                    "Projects reinforce the required skill set." if base >= 55
                    else "Projects are only loosely related to this role."
                )
            elif name == "certifications":
                feedback = (
                    "Certifications support the role requirements." if present
                    else "No certifications detected."
                )
            else:
                feedback = "Section relevance computed against the full job description."

            scores[name] = SectionScore(
                score=round(clamp(score, 0.0, 100.0), 1),
                feedback=feedback,
                similarity=round(similarity, 4),
                present=present,
                suggestions=suggestions,
            )
        return scores


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #
_DEGREE_FIELD_TERMS = [
    "computer science", "computer engineering", "software engineering", "information technology",
    "data science", "machine learning", "artificial intelligence", "statistics", "mathematics",
    "applied mathematics", "physics", "electrical engineering", "mechanical engineering",
    "business administration", "finance", "accounting", "economics", "marketing", "management",
    "information systems", "bioinformatics", "neuroscience", "psychology", "linguistics",
    "design", "human computer interaction", "cybersecurity", "information security",
    "operations research", "engineering management",
]


def re_search_any(text: str, needles: Sequence[str]) -> bool:
    """True when any needle appears in ``text`` (substring match)."""
    return any(needle in text for needle in needles)


__all__ = [
    "SimilarityEngine", "calibrate", "grade_for", "EDUCATION_RANK", "EDUCATION_LABEL",
]
