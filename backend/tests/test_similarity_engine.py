"""Tests for stage 11 — the weighted multi-score engine."""

from __future__ import annotations

import pytest

from config import settings
from core.similarity_engine import (
    SimilarityEngine,
    calibrate,
    grade_for,
    re_search_any,
)
from models.schemas import (
    JDKeyword,
    JobDescriptionEntities,
    PartialSkillMatch,
    ResumeEntities,
    SectionInfo,
    SectionScore,
    SkillMatchResult,
)


@pytest.fixture(scope="module")
def engine(semantic_analyzer, entity_extractor) -> SimilarityEngine:
    return SimilarityEngine(semantic_analyzer=semantic_analyzer, entity_extractor=entity_extractor)


def make_skill_match(matched, missing, partial=(), extra=()) -> SkillMatchResult:
    resume = list(matched) + [p.resume for p in partial] + list(extra)
    jd = list(matched) + list(missing) + [p.jd for p in partial]
    return SkillMatchResult(
        matched=list(matched),
        missing=list(missing),
        partial=list(partial),
        extra=list(extra),
        resume_skills=resume,
        jd_skills=jd,
    )


class TestCalibrate:
    @pytest.mark.parametrize("value", [0.0, 0.1, 0.35, 0.7, 1.0])
    def test_monotonic_and_bounded(self, value: float):
        result = calibrate(value, 0.25)
        assert 0.0 <= result <= 1.0

    def test_zero_maps_to_zero(self):
        assert calibrate(0.0, 0.25) == pytest.approx(0.0)

    def test_increasing_input_increases_output(self):
        assert calibrate(0.6, 0.25) > calibrate(0.3, 0.25) > calibrate(0.1, 0.25)

    def test_larger_tau_softens_the_curve(self):
        assert calibrate(0.4, 0.60) < calibrate(0.4, 0.15)

    def test_tau_zero_is_safe(self):
        assert 0.0 <= calibrate(0.5, 0.0) <= 1.0


class TestGrades:
    @pytest.mark.parametrize(
        "score,grade",
        [(95.0, "A"), (85.0, "A"), (84.9, "B"), (70.0, "B"), (69.9, "C"), (55.0, "C"),
         (54.9, "D"), (40.0, "D"), (39.9, "F"), (0.0, "F")],
    )
    def test_grade_bands(self, score: float, grade: str):
        assert grade_for(score) == grade


class TestKeywordScore:
    def test_full_coverage_scores_high(self, engine: SimilarityEngine):
        keywords = [JDKeyword(keyword=f"skill{i}", found_in_resume=True) for i in range(10)]
        score, detail = engine.compute_keyword_score(0.8, keywords)
        assert score > 70.0
        assert "10/10" in detail

    def test_zero_coverage_scores_low(self, engine: SimilarityEngine):
        keywords = [JDKeyword(keyword=f"skill{i}", found_in_resume=False) for i in range(10)]
        score, detail = engine.compute_keyword_score(0.0, keywords)
        assert score == pytest.approx(0.0)
        assert "0/10" in detail

    def test_coverage_matters_more_than_cosine(self, engine: SimilarityEngine):
        covered = [JDKeyword(keyword=f"a{i}", found_in_resume=True) for i in range(20)]
        uncovered = [JDKeyword(keyword=f"b{i}", found_in_resume=False) for i in range(20)]
        assert engine.compute_keyword_score(0.1, covered)[0] > engine.compute_keyword_score(
            0.9, uncovered
        )[0]

    def test_empty_keyword_list_is_safe(self, engine: SimilarityEngine):
        score, _ = engine.compute_keyword_score(0.5, [])
        assert 0.0 <= score <= 100.0

    def test_top_n_limits_the_considered_keywords(self, engine: SimilarityEngine):
        keywords = [JDKeyword(keyword=f"k{i}", found_in_resume=i < 5) for i in range(50)]
        _, detail = engine.compute_keyword_score(0.3, keywords, top_n=10)
        assert "/10 " in detail


class TestSemanticScore:
    @pytest.mark.parametrize("variant", ["transformer", "lsa"])
    def test_bounded(self, engine: SimilarityEngine, variant: str):
        score, detail = engine.compute_semantic_score(0.72, variant)
        assert 0.0 <= score <= 100.0
        assert detail

    def test_higher_similarity_scores_higher(self, engine: SimilarityEngine):
        low = engine.compute_semantic_score(0.2, "lsa")[0]
        high = engine.compute_semantic_score(0.9, "lsa")[0]
        assert high > low

    def test_lsa_is_scored_more_generously_than_transformer(self):
        """LSA cosines are compressed, so a smaller tau is used to compensate."""
        engine = SimilarityEngine()
        assert engine.compute_semantic_score(0.6, "lsa")[0] > engine.compute_semantic_score(
            0.6, "transformer"
        )[0]

    def test_zero_similarity(self, engine: SimilarityEngine):
        assert engine.compute_semantic_score(0.0, "transformer")[0] == pytest.approx(0.0)


class TestSkillScore:
    def test_delegates_to_the_matcher_score(self, engine: SimilarityEngine):
        result = make_skill_match(["Python", "Docker"], ["Kafka"])
        score, detail = engine.compute_skill_score(result)
        assert 0.0 <= score <= 100.0
        assert "Kafka" in detail or "matched" in detail.lower()

    def test_partial_matches_earn_half_credit(self, engine: SimilarityEngine):
        from core.skill_matcher import get_skill_matcher

        matcher = get_skill_matcher()
        full = matcher.match_skills(["Kubernetes"], ["Kubernetes"])
        # "Kubernetes administration" only fuzzily matches "Kubernetes", so the
        # matcher records it as a partial (half-credit) hit.
        half = matcher.match_skills(["Kubernetes administration"], ["Kubernetes"])
        none = matcher.match_skills(["Terraform"], ["Kubernetes"])
        assert half.partial and not half.matched
        assert engine.compute_skill_score(full)[0] > engine.compute_skill_score(half)[0] > 0.0
        assert engine.compute_skill_score(half)[0] > engine.compute_skill_score(none)[0]

    def test_empty_result_is_zero(self, engine: SimilarityEngine):
        assert engine.compute_skill_score(make_skill_match([], []))[0] == pytest.approx(0.0)


class TestExperienceScore:
    def test_meeting_the_requirement_scores_high(self, engine: SimilarityEngine):
        resume = ResumeEntities(years_experience=8.0, job_titles=["Senior Machine Learning Engineer"])
        jd = JobDescriptionEntities(min_years_experience=5, job_title="Senior Machine Learning Engineer")
        score, detail = engine.compute_experience_score(resume, jd)
        assert score >= 70.0
        assert detail

    def test_falling_short_scores_lower(self, engine: SimilarityEngine):
        resume = ResumeEntities(years_experience=2.0)
        jd = JobDescriptionEntities(min_years_experience=8)
        score, _ = engine.compute_experience_score(resume, jd)
        assert score < 60.0

    def test_no_requirement_is_neutral_to_positive(self, engine: SimilarityEngine):
        resume = ResumeEntities(years_experience=4.0)
        jd = JobDescriptionEntities(min_years_experience=None)
        score, _ = engine.compute_experience_score(resume, jd)
        assert score > 0.0

    def test_quality_signals_add_credit(self, engine: SimilarityEngine):
        resume = ResumeEntities(years_experience=6.0, job_titles=["Machine Learning Engineer"])
        jd = JobDescriptionEntities(min_years_experience=5, job_title="Machine Learning Engineer")
        plain, _ = engine.compute_experience_score(resume, jd)
        enriched, _ = engine.compute_experience_score(
            resume,
            jd,
            section_similarities={"experience": 0.8},
            action_verbs=["Built", "Led", "Designed"],
            quantified_achievements=4,
        )
        assert enriched >= plain

    def test_zero_experience(self, engine: SimilarityEngine):
        score, _ = engine.compute_experience_score(
            ResumeEntities(years_experience=None), JobDescriptionEntities(min_years_experience=5)
        )
        assert score >= 0.0


class TestEducationScore:
    @pytest.mark.parametrize(
        "resume_level,degrees,jd_degree,score_min,score_max",
        [
            ("master", ["M.S. in Computer Science"], "Master's degree in Computer Science", 99.0, 100.0),
            ("master", ["M.A. in History"], "Master's degree in Computer Science", 85.0, 92.0),
            ("bachelor", ["B.S. in Computer Science"], "Master's degree in Computer Science", 50.0, 85.0),
            ("phd", ["Ph.D. in Machine Learning"], "Bachelor's degree required", 90.0, 100.0),
            ("high_school", ["High School Diploma"], "Master's degree preferred", 0.0, 55.0),
        ],
    )
    def test_level_comparison(self, engine: SimilarityEngine, resume_level, degrees, jd_degree, score_min, score_max):
        resume = ResumeEntities(education_level=resume_level, degrees=degrees)
        jd = JobDescriptionEntities(degree_requirement=jd_degree)
        score, detail = engine.compute_education_score(resume, jd, has_education_section=True)
        assert score_min <= score <= score_max, f"{resume_level} vs {jd_degree}: {score} {detail}"

    def test_no_requirement_and_no_degree(self, engine: SimilarityEngine):
        score, _ = engine.compute_education_score(ResumeEntities(), JobDescriptionEntities())
        assert 0.0 <= score <= 100.0

    def test_required_education_level_parsing(self, engine: SimilarityEngine):
        assert engine.required_education_level(
            JobDescriptionEntities(degree_requirement="Ph.D. in Machine Learning")
        ) == "phd"
        assert engine.required_education_level(
            JobDescriptionEntities(degree_requirement="Bachelor's degree in CS")
        ) == "bachelor"
        assert engine.required_education_level(JobDescriptionEntities()) is None

    def test_field_of_study_mismatch_is_penalised(self, engine: SimilarityEngine):
        matched = ResumeEntities(
            education_level="master", degrees=["M.S. in Computer Science"]
        )
        mismatched = ResumeEntities(education_level="master", degrees=["M.A. in History"])
        jd = JobDescriptionEntities(degree_requirement="Master's degree in Computer Science")
        assert engine.compute_education_score(matched, jd)[0] >= engine.compute_education_score(
            mismatched, jd
        )[0]


class TestFullScore:
    def test_weights_are_applied(self, engine: SimilarityEngine, resume_entities, jd_entities):
        keywords = [JDKeyword(keyword="python", found_in_resume=True)]
        result = engine.compute_full_score(
            tfidf_cosine=0.5,
            jd_keywords=keywords,
            semantic_similarity=0.6,
            semantic_variant=engine.semantic.variant if engine.semantic else "lsa",
            skill_match=make_skill_match(["Python"], ["Kafka"]),
            resume_entities=resume_entities,
            jd_entities=jd_entities,
            section_similarities={"experience": 0.6, "skills": 0.7},
            action_verbs=["Built"],
            quantified_achievements=3,
            has_education_section=True,
        )
        assert 0.0 <= result.overall_score <= 100.0
        assert result.grade in {"A", "B", "C", "D", "F"}
        assert result.verdict

        breakdown = result.breakdown
        expected = sum(
            component.score * component.weight
            for component in (
                breakdown.keyword_match,
                breakdown.semantic_similarity,
                breakdown.skill_match,
                breakdown.experience_relevance,
                breakdown.education_match,
            )
        )
        assert result.overall_score == pytest.approx(expected, abs=0.5)

    def test_weights_sum_to_one(self, engine: SimilarityEngine):
        assert sum(engine.weights.values()) == pytest.approx(1.0)
        assert set(engine.weights) == {
            "keyword_match", "semantic_similarity", "skill_match",
            "experience_relevance", "education_match",
        }

    def test_default_weights_match_the_spec(self):
        assert settings.score_weights["keyword_match"] == 0.25
        assert settings.score_weights["semantic_similarity"] == 0.30
        assert settings.score_weights["skill_match"] == 0.25
        assert settings.score_weights["experience_relevance"] == 0.10
        assert settings.score_weights["education_match"] == 0.10

    def test_custom_weights_are_renormalised(self):
        engine = SimilarityEngine(weights={"keyword_match": 1.0, "semantic_similarity": 1.0,
                                           "skill_match": 1.0, "experience_relevance": 1.0,
                                           "education_match": 1.0})
        assert sum(engine.weights.values()) == pytest.approx(1.0)
        assert engine.weights["keyword_match"] == pytest.approx(0.2)

    def test_degenerate_weights_fall_back_to_uniform(self):
        engine = SimilarityEngine(weights={k: 0.0 for k in settings.score_weights})
        assert sum(engine.weights.values()) == pytest.approx(1.0)

    def test_strong_pair_beats_weak_pair(self, engine: SimilarityEngine, resume_entities, jd_entities, cross_result):
        strong = engine.compute_full_score(
            tfidf_cosine=0.6,
            jd_keywords=[JDKeyword(keyword="python", found_in_resume=True)],
            semantic_similarity=0.8,
            semantic_variant="lsa",
            skill_match=make_skill_match(["Python", "Machine Learning"], []),
            resume_entities=resume_entities,
            jd_entities=jd_entities,
            has_education_section=True,
        )
        weak = engine.compute_full_score(
            tfidf_cosine=0.02,
            jd_keywords=[JDKeyword(keyword="terraform", found_in_resume=False)],
            semantic_similarity=0.05,
            semantic_variant="lsa",
            skill_match=make_skill_match([], ["Terraform", "Kubernetes"]),
            resume_entities=ResumeEntities(),
            jd_entities=JobDescriptionEntities(min_years_experience=8),
        )
        assert strong.overall_score > weak.overall_score


class TestVerdict:
    @pytest.mark.parametrize(
        "score,phrase",
        [
            (92.0, "Exceptional"),
            (75.0, "Strong"),
            (60.0, "Moderate"),
            (45.0, "Weak"),
            (12.0, "Poor"),
        ],
    )
    def test_bands(self, score: float, phrase: str):
        text = SimilarityEngine.verdict(
            score, make_skill_match([], []), ResumeEntities(), JobDescriptionEntities()
        )
        assert phrase in text

    def test_mentions_missing_skills(self):
        text = SimilarityEngine.verdict(
            65.0,
            make_skill_match(["Python"], ["Terraform", "Kafka"]),
            ResumeEntities(years_experience=6.0),
            JobDescriptionEntities(min_years_experience=5),
        )
        assert "Terraform" in text
        assert "6y" in text or "experience" in text


class TestSectionScores:
    def test_scores_each_content_section(
        self, engine: SimilarityEngine, resume_sections, resume_entities, jd_entities
    ):
        similarities = {"summary": 0.6, "experience": 0.7, "skills": 0.8, "education": 0.5}
        result = engine.section_scores(
            similarities, resume_sections, make_skill_match(["Python"], []), resume_entities, jd_entities,
            quantified_achievements=3,
        )
        assert set(result) == set(similarities)
        for info in result.values():
            assert isinstance(info, SectionScore)
            assert 0.0 <= info.score <= 100.0
            assert info.present is True
            assert info.feedback

    def test_contact_and_reference_sections_are_skipped(self, engine: SimilarityEngine, resume_entities, jd_entities):
        result = engine.section_scores(
            {"contact": 0.9, "references": 0.9, "skills": 0.6},
            {"contact": SectionInfo(name="contact", present=True),
             "references": SectionInfo(name="references", present=True),
             "skills": SectionInfo(name="skills", present=True)},
            make_skill_match([], []),
            resume_entities,
            jd_entities,
        )
        assert "contact" not in result
        assert "references" not in result

    def test_only_sections_with_a_similarity_are_scored(self, engine: SimilarityEngine, resume_entities, jd_entities):
        """Missing sections are surfaced by the gap analyzer, not scored here."""
        result = engine.section_scores(
            {"skills": 0.4},
            {"skills": SectionInfo(name="skills", present=True),
             "experience": SectionInfo(name="experience", present=False)},
            make_skill_match([], []),
            resume_entities,
            jd_entities,
        )
        assert set(result) == {"skills"}

    def test_absent_section_text_scores_zero(self, engine: SimilarityEngine, resume_entities, jd_entities):
        result = engine.section_scores(
            {"skills": 0.0},
            {"skills": SectionInfo(name="skills", present=False, text="")},
            make_skill_match([], []),
            resume_entities,
            jd_entities,
        )
        assert result["skills"].score == pytest.approx(0.0)

    def test_higher_similarity_scores_higher(self, engine: SimilarityEngine, resume_entities, jd_entities):
        sections = {"skills": SectionInfo(name="skills", present=True, text="Python Docker AWS")}
        low = engine.section_scores({"skills": 0.1}, sections, make_skill_match([], []), resume_entities, jd_entities)
        high = engine.section_scores({"skills": 0.9}, sections, make_skill_match([], []), resume_entities, jd_entities)
        assert high["skills"].score > low["skills"].score


class TestReSearchAny:
    def test_finds_needles(self):
        assert re_search_any("Senior Machine Learning Engineer", ["machine learning"]) is True

    def test_no_match(self):
        assert re_search_any("Registered nurse", ["kubernetes"]) is False

    def test_empty_needles(self):
        assert re_search_any("anything", []) is False

    def test_empty_text(self):
        assert re_search_any("", ["python"]) is False
