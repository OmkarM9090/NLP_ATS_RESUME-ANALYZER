"""Stage 13 — gap analysis.

Turns the comparison artefacts into an explicit list of *what is missing* and
*where the resume is weak*, which is what powers the recommendations and the
results dashboard's gap panel.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from config import settings
from models.schemas import (
    GapAnalysisResult,
    JDKeyword,
    JobDescriptionEntities,
    KeywordAnalysis,
    KeywordGap,
    PartialSkillMatch,
    Priority,
    ResumeEntities,
    SectionScore,
    SkillGap,
    SkillMatchResult,
    WeakSection,
)
from utils.logger import get_logger
from utils.text_utils import clamp, safe_ratio

logger = get_logger(__name__)

#: Sections that a strong resume is expected to contain.
EXPECTED_SECTIONS = ("summary", "experience", "education", "skills")
WEAK_SECTION_THRESHOLD = 55.0
#: Optional sections that *should* be relevant for most professional roles.
#: Others (awards, languages, volunteering, references) legitimately score low
#: against a job description and must not generate "improve this" advice.
ROLE_RELEVANT_OPTIONAL_SECTIONS = ("projects", "certifications")
OPTIONAL_SECTION_THRESHOLD = 25.0


class GapAnalyzer:
    """Identify keyword, skill, section, experience and education gaps."""

    def __init__(self, entity_extractor: Optional[Any] = None) -> None:
        self.entity_extractor = entity_extractor

    # ------------------------------------------------------------------ #
    def analyze_gaps(
        self,
        *,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        skill_match: SkillMatchResult,
        keyword_analysis: KeywordAnalysis,
        section_scores: Optional[Dict[str, SectionScore]] = None,
        detected_sections: Optional[Sequence[str]] = None,
        quantified_achievements: int = 0,
        action_verbs: Sequence[str] = (),
        top_n_keywords: int = 25,
    ) -> GapAnalysisResult:
        """Build the complete gap analysis."""
        section_scores = section_scores or {}
        detected = list(detected_sections or [])

        ignore_terms = self.noise_terms(jd_entities)
        missing_keywords = self.missing_keywords(
            keyword_analysis.top_jd_keywords, top_n_keywords, ignore=ignore_terms
        )
        missing_skills = self.missing_skills(skill_match, jd_entities, keyword_analysis)
        weak_sections = self.weak_sections(section_scores, detected)
        experience_gap = self.experience_gap(resume_entities, jd_entities)
        education_gap = self.education_gap(resume_entities, jd_entities)

        coverage = self.coverage_ratio(
            keyword_analysis.top_jd_keywords, top_n_keywords, ignore=ignore_terms
        )

        result = GapAnalysisResult(
            missing_keywords=missing_keywords,
            missing_skills=missing_skills,
            weak_sections=weak_sections,
            experience_gap=experience_gap,
            education_gap=education_gap,
            terminology_mismatches=list(skill_match.partial),
            coverage_ratio=round(coverage, 4),
        )
        logger.info(
            "gaps_analyzed",
            extra={
                "missing_keywords": len(missing_keywords),
                "missing_skills": len(missing_skills),
                "weak_sections": len(weak_sections),
                "coverage": result.coverage_ratio,
                "experience_gap": bool(experience_gap),
                "education_gap": bool(education_gap),
            },
        )
        return result

    # ------------------------------------------------------------------ #
    @staticmethod
    def noise_terms(jd_entities: JobDescriptionEntities) -> Set[str]:
        """Terms that are real job-description keywords but useless as advice.

        A candidate cannot (and should not) add the hiring company's name or its
        office location to a resume, so those are excluded from gap reporting —
        they stay visible in the raw keyword list.
        """
        noise: Set[str] = set()
        organization = getattr(jd_entities, "organization", None)
        if organization:
            for part in re.split(r"[^\w&]+", str(organization).lower()):
                if len(part) > 2:
                    noise.add(part)
            noise.add(str(organization).strip().lower())
        for location in getattr(jd_entities, "locations", None) or []:
            text = str(location).strip().lower()
            if text:
                noise.add(text)
        for term in ("equal opportunity employer", "about the role", "benefits"):
            noise.add(term)
        return noise

    def missing_keywords(
        self,
        jd_keywords: Sequence[JDKeyword],
        top_n: int = 25,
        ignore: Optional[Iterable[str]] = None,
    ) -> List[KeywordGap]:
        """High-value JD keywords absent from the resume, worst first."""
        ignored = {str(term).strip().lower() for term in (ignore or ()) if str(term).strip()}
        gaps: List[KeywordGap] = []
        for keyword in list(jd_keywords)[:top_n]:
            if keyword.found_in_resume:
                continue
            lowered = keyword.keyword.strip().lower()
            if lowered in ignored or any(part in ignored for part in lowered.split()):
                continue
            importance = keyword.importance or keyword.tfidf_score
            gaps.append(
                KeywordGap(
                    keyword=keyword.keyword,
                    occurrences=max(keyword.occurrences, 1),
                    importance=round(importance, 4),
                    severity=self._severity_for_importance(importance),
                )
            )
        gaps.sort(key=lambda gap: (-gap.importance, gap.keyword))
        return gaps

    @staticmethod
    def _severity_for_importance(importance: float) -> Priority:
        if importance >= 0.35:
            return Priority.HIGH
        if importance >= 0.15:
            return Priority.MEDIUM
        return Priority.LOW

    # ------------------------------------------------------------------ #
    def missing_skills(
        self,
        skill_match: SkillMatchResult,
        jd_entities: JobDescriptionEntities,
        keyword_analysis: KeywordAnalysis,
    ) -> List[SkillGap]:
        """Missing skills, ranked by whether the JD treats them as required."""
        required = {s.lower() for s in jd_entities.required_skills}
        preferred = {s.lower() for s in jd_entities.preferred_skills}
        mention_counts: Dict[str, int] = {
            k.keyword.lower(): max(k.occurrences, 1) for k in keyword_analysis.top_jd_keywords
        }

        gaps: List[SkillGap] = []
        for skill in skill_match.missing:
            lowered = skill.lower()
            if lowered in preferred and lowered not in required:
                importance = "low"
            elif lowered in required:
                importance = "high"
            else:
                importance = "medium"
            category = self._category_of(skill)
            gaps.append(
                SkillGap(
                    skill=skill,
                    category=category,
                    importance=importance,
                    mentioned_in_jd=mention_counts.get(lowered, 1),
                )
            )

        order = {"high": 0, "medium": 1, "low": 2}
        gaps.sort(key=lambda gap: (order.get(gap.importance, 3), -gap.mentioned_in_jd, gap.skill))
        return gaps

    def _category_of(self, skill: str) -> str:
        if self.entity_extractor is None:
            return "other"
        try:
            return self.entity_extractor.skill_category(skill) or "other"
        except Exception:  # noqa: BLE001 - never fail gap analysis on a lookup
            return "other"

    # ------------------------------------------------------------------ #
    def weak_sections(
        self, section_scores: Dict[str, SectionScore], detected: Sequence[str]
    ) -> List[WeakSection]:
        """Sections that score poorly or are missing entirely."""
        weak: List[WeakSection] = []

        for name in EXPECTED_SECTIONS:
            info = section_scores.get(name)
            if info is None or not info.present:
                if name not in detected:
                    weak.append(
                        WeakSection(
                            section=name,
                            score=0.0,
                            issue=f"No '{name}' section was detected on the resume.",
                            suggestion=self._section_suggestion(name),
                        )
                    )
                continue
            if info.score < WEAK_SECTION_THRESHOLD:
                weak.append(
                    WeakSection(
                        section=name,
                        score=round(info.score, 1),
                        issue=info.feedback or f"The '{name}' section scores {info.score:.0f}/100.",
                        suggestion=(info.suggestions[0] if info.suggestions else self._section_suggestion(name)),
                    )
                )

        for name, info in section_scores.items():
            if name in EXPECTED_SECTIONS or name not in ROLE_RELEVANT_OPTIONAL_SECTIONS:
                continue
            if info.present and info.score < OPTIONAL_SECTION_THRESHOLD:
                weak.append(
                    WeakSection(
                        section=name,
                        score=round(info.score, 1),
                        issue=f"The '{name}' section has little relevance to this job description.",
                        suggestion="Trim or re-target this section towards the role's requirements.",
                    )
                )

        weak.sort(key=lambda item: item.score)
        return weak

    @staticmethod
    def _section_suggestion(name: str) -> str:
        return {
            "summary": (
                "Add a 2-3 line professional summary naming the target role and its "
                "top three required skills."
            ),
            "experience": (
                "Add a work experience section with role, company, dates and bullet-point "
                "achievements."
            ),
            "education": (
                "Add an education section listing degree, field of study, institution "
                "and graduation year."
            ),
            "skills": (
                "Add a dedicated skills section listing the technologies named in the "
                "job description that you actually know."
            ),
        }.get(name, f"Strengthen the '{name}' section.")

    # ------------------------------------------------------------------ #
    def experience_gap(
        self, resume_entities: ResumeEntities, jd_entities: JobDescriptionEntities
    ) -> Optional[str]:
        """Human-readable experience shortfall, or ``None`` when satisfied."""
        required = jd_entities.min_years_experience
        if not required:
            return None
        years = resume_entities.years_experience
        if years is None:
            return (
                f"The posting asks for {required:g}+ years of experience but no dates or "
                "experience statements could be parsed from the resume."
            )
        if years + 0.25 < required:
            shortfall = required - years
            return (
                f"Resume shows ~{years:.1f} years of experience against a requirement of "
                f"{required:g}+ years (short by ~{shortfall:.1f} years)."
            )
        return None

    def education_gap(
        self, resume_entities: ResumeEntities, jd_entities: JobDescriptionEntities
    ) -> Optional[str]:
        """Human-readable education shortfall, or ``None`` when satisfied."""
        requirement = jd_entities.degree_requirement
        if not requirement:
            return None
        if not resume_entities.education_level and not resume_entities.degrees:
            return (
                "The posting states an education requirement "
                f"({requirement[:120]}...) but no degree was detected on the resume."
            )
        from core.similarity_engine import EDUCATION_LABEL, EDUCATION_RANK

        required_level = None
        phrase = requirement.lower()
        for level, needles in (
            ("phd", ("phd", "ph.d", "doctorate")),
            ("master", ("master", "m.s.", "msc", "mba", "postgraduate")),
            ("bachelor", ("bachelor", "b.s.", "bsc", "b.tech", "undergraduate")),
            ("associate", ("associate degree", "diploma")),
        ):
            if any(needle in phrase for needle in needles):
                required_level = level
                break
        if required_level is None:
            return None
        resume_rank = EDUCATION_RANK.get(resume_entities.education_level or "", -1)
        if resume_rank >= EDUCATION_RANK[required_level]:
            return None
        detected = EDUCATION_LABEL.get(resume_entities.education_level or "", "No degree")
        return (
            f"Detected education level ({detected}) is below the stated requirement "
            f"({EDUCATION_LABEL[required_level]})."
        )

    # ------------------------------------------------------------------ #
    @staticmethod
    def coverage_ratio(
        jd_keywords: Sequence[JDKeyword],
        top_n: int = 25,
        ignore: Optional[Iterable[str]] = None,
    ) -> float:
        """Fraction of the top JD keywords present in the resume.

        Terms in ``ignore`` (company name, office location, ...) are excluded
        from both sides of the ratio so a candidate is not penalised for
        something they cannot honestly add.
        """
        ignored = {str(term).strip().lower() for term in (ignore or ()) if str(term).strip()}

        def keep(keyword: JDKeyword) -> bool:
            lowered = keyword.keyword.strip().lower()
            if lowered in ignored:
                return False
            return not any(part in ignored for part in lowered.split())

        considered = [k for k in list(jd_keywords)[:top_n] if keep(k)]
        if not considered:
            return 0.0
        return safe_ratio(sum(1 for k in considered if k.found_in_resume), len(considered))


#: Shared analyser instance.
gap_analyzer = GapAnalyzer()

__all__ = [
    "GapAnalyzer",
    "gap_analyzer",
    "EXPECTED_SECTIONS",
    "WEAK_SECTION_THRESHOLD",
    "ROLE_RELEVANT_OPTIONAL_SECTIONS",
    "OPTIONAL_SECTION_THRESHOLD",
]
