"""Stage 11 — skill taxonomy matching.

Three-tier comparison between the skills found in a resume and the skills
required by a job description:

1. **Canonicalisation** — every surface form is mapped to its taxonomy canonical
   name (``js`` -> ``JavaScript``, ``k8s`` -> ``Kubernetes``) so aliases never
   count as misses.
2. **Exact match** — canonical sets intersect.
3. **Fuzzy match** — ``rapidfuzz`` token-set ratio >= ``skill_fuzzy_threshold``
   catches near misses (``data analysis`` vs ``data analytics``).
4. **Semantic match** — embedding cosine >= ``skill_semantic_threshold`` catches
   paraphrases that share no characters (``scikit-learn`` vs ``machine learning
   libraries``). Only used when an encoder is available.

Also reports precision / recall / F1 and per-category grouping, which drive the
gap analysis and the UI's skill grid.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from config import settings
from models.schemas import PartialSkillMatch, SkillMatchResult
from utils.logger import get_logger
from utils.text_utils import clamp, collapse_whitespace, dedupe_preserve_order, safe_ratio

logger = get_logger(__name__)

try:  # rapidfuzz is in requirements; degrade to difflib if it is missing.
    from rapidfuzz import fuzz

    def _token_set_ratio(a: str, b: str) -> float:
        return float(fuzz.token_set_ratio(a, b))

    def _partial_ratio(a: str, b: str) -> float:
        return float(fuzz.partial_ratio(a, b))

except ImportError:  # pragma: no cover
    import difflib

    def _token_set_ratio(a: str, b: str) -> float:
        return 100.0 * difflib.SequenceMatcher(None, a, b).ratio()

    def _partial_ratio(a: str, b: str) -> float:
        return 100.0 * difflib.SequenceMatcher(None, a, b).ratio()


class SkillMatcher:
    """Taxonomy-aware skill comparison with fuzzy and semantic fallbacks."""

    def __init__(
        self,
        taxonomy: Optional[Dict[str, Any]] = None,
        entity_extractor: Optional[Any] = None,
        semantic_analyzer: Optional[Any] = None,
    ) -> None:
        from services.cache_service import load_json

        self.taxonomy = taxonomy if taxonomy is not None else load_json(settings.skill_taxonomy_path, {})
        self.entity_extractor = entity_extractor
        self.semantic = semantic_analyzer
        self._canonical_map, self._category_map = self._build_maps()

    # ------------------------------------------------------------------ #
    def _build_maps(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        """Build ``surface -> canonical`` and ``canonical -> category`` maps."""
        canonical_map: Dict[str, str] = {}
        category_map: Dict[str, str] = {}
        for category, entries in self.taxonomy.items():
            if category.startswith("_") or not isinstance(entries, dict):
                continue
            for canonical, aliases in entries.items():
                canonical_clean = str(canonical).strip()
                if not canonical_clean:
                    continue
                key = canonical_clean.lower()
                category_map[key] = category
                canonical_map[key] = canonical_clean
                for alias in aliases if isinstance(aliases, list) else []:
                    alias_clean = str(alias).strip().lower()
                    if alias_clean and alias_clean not in canonical_map:
                        canonical_map[alias_clean] = canonical_clean
        return canonical_map, category_map

    # ------------------------------------------------------------------ #
    def canonicalize(self, skill: str) -> str:
        """Map any skill surface form to its canonical taxonomy name."""
        cleaned = collapse_whitespace((skill or "").strip())
        if not cleaned:
            return ""
        direct = self._canonical_map.get(cleaned.lower())
        if direct:
            return direct
        if self.entity_extractor is not None:
            mapped = self.entity_extractor.canonicalize_skill(cleaned)
            if mapped:
                return mapped
        return cleaned

    def category_of(self, skill: str) -> str:
        """Taxonomy category for a skill (``"other"`` when unknown)."""
        canonical = self.canonicalize(skill).lower()
        return self._category_map.get(canonical, "other")

    def normalize(self, skills: Iterable[str]) -> List[str]:
        """Canonicalise + deduplicate a skill list, preserving order."""
        return dedupe_preserve_order(
            self.canonicalize(skill) for skill in skills if (skill or "").strip()
        )

    # ------------------------------------------------------------------ #
    def match_skills(
        self,
        resume_skills: Sequence[str],
        jd_skills: Sequence[str],
        *,
        use_semantic: bool = True,
    ) -> SkillMatchResult:
        """Compare two skill lists and categorise the result."""
        resume = self.normalize(resume_skills)
        jd = self.normalize(jd_skills)

        resume_lookup = {skill.lower(): skill for skill in resume}
        jd_lookup = {skill.lower(): skill for skill in jd}

        matched: List[str] = []
        partial: List[PartialSkillMatch] = []
        matched_resume: set[str] = set()

        # 1. Exact canonical matches -------------------------------------- #
        for key, jd_skill in jd_lookup.items():
            if key in resume_lookup:
                matched.append(jd_skill)
                matched_resume.add(key)

        unmatched_jd = [s for k, s in jd_lookup.items() if k not in resume_lookup]
        unmatched_resume = [s for k, s in resume_lookup.items() if k not in {m.lower() for m in matched}]

        # 2. Fuzzy matches ------------------------------------------------ #
        still_missing: List[str] = []
        fuzzy_threshold = settings.skill_fuzzy_threshold
        for jd_skill in unmatched_jd:
            best: Optional[Tuple[float, str, str]] = None
            for resume_skill in unmatched_resume:
                if resume_skill.lower() in matched_resume:
                    continue
                score = max(_token_set_ratio(jd_skill, resume_skill), _partial_ratio(jd_skill, resume_skill))
                if best is None or score > best[0]:
                    best = (score, resume_skill, "fuzzy")
            if best and best[0] >= fuzzy_threshold:
                partial.append(
                    PartialSkillMatch(
                        resume=best[1], jd=jd_skill, similarity=round(best[0] / 100.0, 4),
                        match_type=best[2],
                    )
                )
                matched_resume.add(best[1].lower())
            else:
                still_missing.append(jd_skill)

        # 3. Semantic matches (only for what fuzzy matching left behind) --- #
        # The LSA fallback encoder is too coarse for short skill phrases (it
        # happily links "Data Visualization" to "Data Science"), so semantic
        # matching only runs when the real transformer encoder is available.
        encoder_is_transformer = (
            self.semantic is not None and getattr(self.semantic, "variant", "") == "transformer"
        )
        missing: List[str] = []
        if (
            still_missing
            and use_semantic
            and self.semantic is not None
            and encoder_is_transformer
            and unmatched_resume
        ):
            try:
                candidates = [r for r in unmatched_resume if r.lower() not in matched_resume]
                if candidates:
                    vectors = self.semantic.embed(still_missing + candidates)
                    n_missing = len(still_missing)
                    for idx, jd_skill in enumerate(still_missing):
                        best_score = 0.0
                        best_resume = ""
                        for offset, resume_skill in enumerate(candidates):
                            from core.semantic_analyzer import cosine

                            score = cosine(vectors[idx], vectors[n_missing + offset])
                            if score > best_score:
                                best_score, best_resume = score, resume_skill
                        if best_score >= settings.skill_semantic_threshold:
                            partial.append(
                                PartialSkillMatch(
                                    resume=best_resume, jd=jd_skill,
                                    similarity=round(best_score, 4), match_type="semantic",
                                )
                            )
                            matched_resume.add(best_resume.lower())
                        else:
                            missing.append(jd_skill)
                else:
                    missing = still_missing
            except Exception as exc:  # noqa: BLE001 - semantic is best effort
                logger.debug("semantic_skill_match_failed", extra={"error": str(exc)})
                missing = still_missing
        else:
            missing = still_missing

        extra = [s for s in resume if s.lower() not in matched_resume]

        matched_by_category: Dict[str, List[str]] = {}
        for skill in matched:
            matched_by_category.setdefault(self.category_of(skill), []).append(skill)
        missing_by_category: Dict[str, List[str]] = {}
        for skill in missing:
            missing_by_category.setdefault(self.category_of(skill), []).append(skill)

        # Metrics ----------------------------------------------------------- #
        partial_credit = 0.5 * len(partial)
        recall = safe_ratio(len(matched) + partial_credit, len(jd))
        precision = safe_ratio(len(matched) + partial_credit, len(matched) + len(partial) + len(extra))
        f1 = safe_ratio(2 * precision * recall, precision + recall) if (precision + recall) else 0.0
        score = clamp(100.0 * (len(matched) + partial_credit) / max(1, len(jd)), 0.0, 100.0)
        if not jd:
            # Nothing to match against: score on whether the resume shows skills at all.
            score = 100.0 if resume else 0.0

        result = SkillMatchResult(
            matched=sorted(matched, key=str.lower),
            missing=sorted(missing, key=str.lower),
            partial=sorted(partial, key=lambda p: -p.similarity),
            extra=sorted(extra, key=str.lower),
            resume_skills=resume,
            jd_skills=jd,
            matched_by_category=matched_by_category,
            missing_by_category=missing_by_category,
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1=round(f1, 4),
            score=round(score, 2),
        )
        logger.info(
            "skills_matched",
            extra={
                "resume_skills": len(resume),
                "jd_skills": len(jd),
                "matched": len(matched),
                "partial": len(partial),
                "missing": len(missing),
                "extra": len(extra),
                "score": result.score,
            },
        )
        return result


#: Shared matcher instance (constructed lazily by the analysis service).
_skill_matcher: Optional[SkillMatcher] = None


def get_skill_matcher(**kwargs: Any) -> SkillMatcher:
    """Return a process-wide :class:`SkillMatcher`."""
    global _skill_matcher
    if _skill_matcher is None:
        _skill_matcher = SkillMatcher(**kwargs)
    return _skill_matcher


__all__ = ["SkillMatcher", "get_skill_matcher"]
