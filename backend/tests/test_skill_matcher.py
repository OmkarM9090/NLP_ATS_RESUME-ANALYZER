"""Tests for the taxonomy-aware skill matcher."""

from __future__ import annotations

import pytest

from core.skill_matcher import SkillMatcher, get_skill_matcher
from models.schemas import PartialSkillMatch, SkillMatchResult


@pytest.fixture(scope="module")
def matcher(entity_extractor, semantic_analyzer) -> SkillMatcher:
    return SkillMatcher(entity_extractor=entity_extractor, semantic_analyzer=semantic_analyzer)


class TestCanonicalisation:
    @pytest.mark.parametrize(
        "surface,expected",
        [
            ("k8s", "Kubernetes"),
            ("pytorch", "PyTorch"),
            ("scikit learn", "scikit-learn"),
            ("postgres", "PostgreSQL"),
            ("javascript", "JavaScript"),
            ("tensorflow", "TensorFlow"),
            ("machine learning ops", "MLOps"),
            ("ml operations", "MLOps"),
            ("restful api design", "REST APIs"),
        ],
    )
    def test_aliases_resolve_to_canonical_names(self, matcher: SkillMatcher, surface: str, expected: str):
        assert matcher.canonicalize(surface) == expected

    def test_unknown_surface_is_returned_normalised(self, matcher: SkillMatcher):
        assert matcher.canonicalize("  quantum  flux  ") == "quantum flux"
        assert matcher.canonicalize("") == ""

    def test_category_lookup(self, matcher: SkillMatcher):
        assert matcher.category_of("Python")
        assert matcher.category_of("Kubernetes")
        # Unknown skills fall into the catch-all bucket rather than raising.
        assert matcher.category_of("zzz-not-a-skill") == "other"

    def test_taxonomy_is_loaded(self, matcher: SkillMatcher):
        assert matcher.taxonomy
        assert matcher._canonical_map
        assert matcher._category_map


class TestNormalise:
    def test_dedupes_case_insensitively(self, matcher: SkillMatcher):
        assert matcher.normalize(["Python", "python", "PYTHON"]) == ["Python"]

    def test_canonicalises_each_entry(self, matcher: SkillMatcher):
        assert matcher.normalize(["k8s", "Postgres"]) == ["Kubernetes", "PostgreSQL"]

    def test_preserves_order_and_drops_blanks(self, matcher: SkillMatcher):
        result = matcher.normalize(["Docker", "", "   ", "Kafka"])
        assert result == ["Docker", "Kafka"]

    def test_empty_input(self, matcher: SkillMatcher):
        assert matcher.normalize([]) == []


class TestMatchSkills:
    def test_exact_matches(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Python", "Docker"], ["Python", "Docker", "Kafka"])
        assert isinstance(result, SkillMatchResult)
        assert set(result.matched) == {"Python", "Docker"}
        assert "Kafka" in result.missing
        assert result.extra == []

    def test_alias_matches_count_as_matched(self, matcher: SkillMatcher):
        result = matcher.match_skills(["k8s", "scikit learn"], ["Kubernetes", "scikit-learn"])
        assert set(result.matched) == {"Kubernetes", "scikit-learn"}
        assert result.missing == []

    def test_extra_skills_are_reported(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Python", "Terraform", "Rust"], ["Python"])
        assert "Terraform" in result.extra
        assert "Rust" in result.extra

    def test_perfect_match_scores_100(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Python", "SQL"], ["Python", "SQL"])
        assert result.score == pytest.approx(100.0)
        assert result.precision == pytest.approx(1.0)
        assert result.recall == pytest.approx(1.0)
        assert result.f1 == pytest.approx(1.0)

    def test_no_overlap_scores_zero(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Nursing", "Triage"], ["Kubernetes", "Terraform"])
        assert result.score == pytest.approx(0.0)
        assert result.matched == []
        assert set(result.missing) == {"Kubernetes", "Terraform"}

    def test_score_is_bounded(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Python"], ["Python", "Go", "Rust", "Terraform"])
        assert 0.0 <= result.score <= 100.0
        assert 0.0 <= result.recall <= 1.0

    def test_partial_matches_are_described(self, matcher: SkillMatcher):
        result = matcher.match_skills(
            ["Data Analysis", "Machine Learning"], ["Data Analytics", "Machine Learning"]
        )
        for partial in result.partial:
            assert isinstance(partial, PartialSkillMatch)
            assert 0.0 <= partial.similarity <= 1.0
            assert partial.resume and partial.jd
            assert partial.match_type in {"fuzzy", "semantic"}

    def test_categories_are_grouped(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Python"], ["Python", "Kubernetes"])
        assert isinstance(result.matched_by_category, dict)
        assert isinstance(result.missing_by_category, dict)
        assert all(isinstance(values, list) for values in result.missing_by_category.values())

    def test_empty_inputs_are_safe(self, matcher: SkillMatcher):
        result = matcher.match_skills([], [])
        assert result.score == 0.0
        assert result.matched == [] and result.missing == []

    def test_empty_resume_against_populated_jd(self, matcher: SkillMatcher):
        result = matcher.match_skills([], ["Python", "Docker"])
        assert result.score == pytest.approx(0.0)
        assert set(result.missing) == {"Python", "Docker"}

    def test_semantic_can_be_disabled(self, matcher: SkillMatcher):
        without = matcher.match_skills(
            ["Data Analysis"], ["Data Analytics"], use_semantic=False
        )
        assert isinstance(without, SkillMatchResult)
        assert 0.0 <= without.score <= 100.0

    def test_inputs_are_echoed_back(self, matcher: SkillMatcher):
        result = matcher.match_skills(["Python", "Docker"], ["Python", "Kafka"])
        assert set(result.resume_skills) == {"Python", "Docker"}
        assert set(result.jd_skills) == {"Python", "Kafka"}


class TestModuleFactory:
    def test_get_skill_matcher_is_a_singleton(self):
        first = get_skill_matcher()
        second = get_skill_matcher()
        assert isinstance(first, SkillMatcher)
        assert first is second
