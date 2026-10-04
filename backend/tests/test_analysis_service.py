"""Integration tests for the analysis orchestrator (all 12 pipeline stages)."""

from __future__ import annotations

import pytest

from config import settings
from models.schemas import AnalysisResponse, ExtractionMethod
from services.analysis_service import AnalysisService
from tests.fixtures import SAMPLE_JD_TEXT, SAMPLE_RESUME_TEXT, build_pdf, sample_jd_pdf, sample_resume_pdf
from utils.exceptions import ATSError


class TestResponseShape:
    """The response contract the frontend depends on."""

    def test_is_an_analysis_response(self, analysis_result):
        assert isinstance(analysis_result, AnalysisResponse)

    def test_top_level_fields(self, analysis_result: AnalysisResponse):
        assert analysis_result.id
        assert analysis_result.timestamp is not None
        assert 0.0 <= analysis_result.overall_score <= 100.0
        assert analysis_result.grade in {"A", "B", "C", "D", "F"}
        assert analysis_result.verdict
        assert analysis_result.score_band

    def test_score_breakdown_has_the_five_specified_dimensions(self, analysis_result: AnalysisResponse):
        breakdown = analysis_result.score_breakdown
        components = {
            "keyword_match": breakdown.keyword_match,
            "semantic_similarity": breakdown.semantic_similarity,
            "skill_match": breakdown.skill_match,
            "experience_relevance": breakdown.experience_relevance,
            "education_match": breakdown.education_match,
        }
        for name, component in components.items():
            assert 0.0 <= component.score <= 100.0, name
            assert component.weight > 0.0, name
            assert component.detail, name
            assert component.weighted_score == pytest.approx(component.score * component.weight, abs=0.05)

    def test_weights_match_the_spec(self, analysis_result: AnalysisResponse):
        breakdown = analysis_result.score_breakdown
        assert breakdown.keyword_match.weight == pytest.approx(0.25)
        assert breakdown.semantic_similarity.weight == pytest.approx(0.30)
        assert breakdown.skill_match.weight == pytest.approx(0.25)
        assert breakdown.experience_relevance.weight == pytest.approx(0.10)
        assert breakdown.education_match.weight == pytest.approx(0.10)

    def test_overall_score_is_the_weighted_sum(self, analysis_result: AnalysisResponse):
        breakdown = analysis_result.score_breakdown
        total = sum(
            component.weighted_score
            for component in (
                breakdown.keyword_match, breakdown.semantic_similarity, breakdown.skill_match,
                breakdown.experience_relevance, breakdown.education_match,
            )
        )
        assert analysis_result.overall_score == pytest.approx(total, abs=0.6)

    def test_grade_is_consistent_with_the_score(self, analysis_result: AnalysisResponse):
        score, grade = analysis_result.overall_score, analysis_result.grade
        if grade == "A":
            assert score >= 85
        elif grade == "B":
            assert 70 <= score < 85
        elif grade == "C":
            assert 55 <= score < 70
        elif grade == "D":
            assert 40 <= score < 55
        else:
            assert score < 40

    def test_skills_analysis(self, analysis_result: AnalysisResponse):
        skills = analysis_result.skills_analysis
        assert skills.matched, "the sample pair shares many skills"
        assert isinstance(skills.missing, list)
        assert isinstance(skills.extra, list)
        assert not set(skills.matched) & set(skills.missing)

    def test_keyword_analysis(self, analysis_result: AnalysisResponse):
        keywords = analysis_result.keyword_analysis
        assert keywords.top_jd_keywords
        assert 0.0 <= keywords.tfidf_cosine_similarity <= 1.0
        assert keywords.keyword_density.resume_status in {"optimal", "under_optimized", "over_optimized"}
        assert any(kw.found_in_resume for kw in keywords.top_jd_keywords)

    def test_entity_extraction(self, analysis_result: AnalysisResponse):
        entities = analysis_result.entity_extraction
        assert entities.resume.person == "John Doe"
        assert entities.resume.skills
        assert entities.job_description.organization == "TechCorp"
        assert entities.job_description.required_skills

    def test_section_scores(self, analysis_result: AnalysisResponse):
        assert analysis_result.section_scores
        for name, info in analysis_result.section_scores.items():
            assert 0.0 <= info.score <= 100.0, name
            assert info.feedback, name

    def test_ats_formatting(self, analysis_result: AnalysisResponse):
        ats = analysis_result.ats_formatting
        assert 0.0 <= ats.score <= 100.0
        assert ats.checks_total >= 10
        assert ats.contact_info_found is True
        assert ats.standard_headers_used is True

    def test_recommendations(self, analysis_result: AnalysisResponse):
        recs = analysis_result.recommendations
        assert recs
        assert len(recs) <= 14
        assert all(rec.message and rec.action and rec.category for rec in recs)

    def test_nlp_metadata(self, analysis_result: AnalysisResponse):
        meta = analysis_result.nlp_metadata
        assert meta.resume_word_count > 100
        assert meta.jd_word_count > 100
        assert meta.processing_time_ms > 0
        assert meta.models_used
        assert meta.pipeline_stages_completed
        assert meta.resume_extraction_method == ExtractionMethod.PDFPLUMBER.value

    def test_filenames_are_echoed(self, analysis_result: AnalysisResponse):
        assert analysis_result.resume_filename == "john_doe_resume.pdf"
        assert analysis_result.jd_filename == "senior_ml_engineer_jd.pdf"

    def test_previews_are_truncated(self, analysis_result: AnalysisResponse):
        assert analysis_result.resume_preview
        assert len(analysis_result.resume_preview) <= 400


class TestPipelineStages:
    def test_every_documented_stage_runs(self, analysis_result: AnalysisResponse):
        """The 12-stage pipeline is observable through nlp_metadata."""
        stages = analysis_result.nlp_metadata.pipeline_stages_completed
        for expected in (
            "extracting_text", "cleaning_text", "tokenizing", "removing_stop_words",
            "pos_tagging", "lemmatizing", "entity_recognition", "parsing_sections",
            "extracting_entities", "extracting_keywords", "matching_skills", "vectorizing",
            "computing_semantic_similarity", "computing_scores", "analyzing_gaps",
            "generating_report", "complete",
        ):
            assert expected in stages, f"stage {expected} missing from {stages}"

    def test_stages_are_ordered(self, analysis_result: AnalysisResponse):
        stages = analysis_result.nlp_metadata.pipeline_stages_completed
        order = [
            "extracting_text", "cleaning_text", "tokenizing", "pos_tagging",
            "removing_stop_words", "lemmatizing", "entity_recognition",
            "parsing_sections", "extracting_keywords",
            "matching_skills", "vectorizing", "computing_semantic_similarity",
            "computing_scores", "analyzing_gaps", "generating_report", "complete",
        ]
        positions = [stages.index(name) for name in order]
        assert positions == sorted(positions), f"out of order: {list(zip(order, positions))}"
        assert stages[-1] == "complete"

    def test_progress_callback_is_monotonic(self, analysis_service: AnalysisService):
        from tests.fixtures import sample_jd_pdf, sample_resume_pdf

        seen: list[tuple[str, float]] = []
        analysis_service.run_full_analysis(
            sample_resume_pdf(), sample_jd_pdf(),
            resume_filename="r.pdf", jd_filename="j.pdf",
            progress=lambda stage, pct: seen.append((stage, pct)),
        )
        percentages = [pct for _, pct in seen]
        assert percentages == sorted(percentages), "progress went backwards"
        assert percentages[0] <= 0.1 and percentages[-1] == 1.0


class TestDegradation:
    def test_sandbox_runs_in_degraded_mode(self, analysis_result: AnalysisResponse):
        """No spaCy weights / no transformers here — this must be reported."""
        assert analysis_result.nlp_metadata.degraded_mode is True
        assert analysis_result.nlp_metadata.warnings

    def test_analysis_still_succeeds(self, analysis_result: AnalysisResponse):
        assert analysis_result.overall_score > 0.0
        assert analysis_result.skills_analysis.matched


class TestDiscrimination:
    def test_matching_pair_beats_unrelated_pair(self, analysis_result, cross_result):
        assert analysis_result.overall_score > cross_result.overall_score

    def test_unrelated_pair_has_fewer_matched_skills(self, analysis_result, cross_result):
        assert len(analysis_result.skills_analysis.matched) > len(cross_result.skills_analysis.matched)

    def test_unrelated_pair_has_more_gaps(self, analysis_result, cross_result):
        assert len(cross_result.gap_analysis.missing_skills) >= len(
            analysis_result.gap_analysis.missing_skills
        )

    def test_unrelated_pair_still_returns_a_valid_response(self, cross_result: AnalysisResponse):
        assert 0.0 <= cross_result.overall_score <= 100.0
        assert cross_result.grade in {"A", "B", "C", "D", "F"}
        assert cross_result.recommendations


class TestInputFormats:
    def test_plain_text_inputs(self, analysis_service: AnalysisService):
        result = analysis_service.run_full_analysis(
            SAMPLE_RESUME_TEXT.encode("utf-8"),
            SAMPLE_JD_TEXT.encode("utf-8"),
            resume_filename="resume.txt",
            jd_filename="job_description.txt",
        )
        assert result.nlp_metadata.resume_extraction_method == ExtractionMethod.PLAIN_TEXT.value
        assert result.overall_score > 0.0

    def test_mixed_formats(self, analysis_service: AnalysisService):
        result = analysis_service.run_full_analysis(
            sample_resume_pdf(),
            SAMPLE_JD_TEXT.encode("utf-8"),
            resume_filename="resume.pdf",
            jd_filename="job_description.txt",
        )
        assert result.nlp_metadata.resume_extraction_method == ExtractionMethod.PDFPLUMBER.value
        assert result.nlp_metadata.jd_extraction_method == ExtractionMethod.PLAIN_TEXT.value

    def test_unstructured_text_without_headings(self, analysis_service: AnalysisService):
        blob = (
            "Jane Smith is a data analyst with six years of experience using SQL, "
            "Python and Tableau to build dashboards for retail clients. She studied "
            "statistics at university and enjoys mentoring junior analysts."
        )
        result = analysis_service.run_full_analysis(
            blob.encode("utf-8"), SAMPLE_JD_TEXT.encode("utf-8"),
            resume_filename="jane.txt", jd_filename="jd.txt",
        )
        assert isinstance(result, AnalysisResponse)
        assert 0.0 <= result.overall_score <= 100.0

    def test_empty_resume_is_rejected(self, analysis_service: AnalysisService):
        with pytest.raises(ATSError) as excinfo:
            analysis_service.run_full_analysis(
                b"", SAMPLE_JD_TEXT.encode("utf-8"),
                resume_filename="empty.pdf", jd_filename="jd.txt",
            )
        assert excinfo.value.status_code in {400, 422}

    def test_unsupported_extension_is_rejected(self, analysis_service: AnalysisService):
        with pytest.raises(ATSError) as excinfo:
            analysis_service.run_full_analysis(
                b"gif-bytes", SAMPLE_JD_TEXT.encode("utf-8"),
                resume_filename="resume.gif", jd_filename="jd.txt",
            )
        assert excinfo.value.status_code == 415


class TestOptions:
    def test_custom_weights_are_reported_verbatim(self, analysis_service: AnalysisService):
        weights = {
            "keyword_match": 0.4, "semantic_similarity": 0.2, "skill_match": 0.2,
            "experience_relevance": 0.1, "education_match": 0.1,
        }
        result = analysis_service.run_full_analysis(
            sample_resume_pdf(), sample_jd_pdf(),
            resume_filename="resume.pdf", jd_filename="jd.pdf", weights=weights,
        )
        assert result.score_breakdown.keyword_match.weight == pytest.approx(0.4)
        assert result.score_breakdown.semantic_similarity.weight == pytest.approx(0.2)

    def test_weights_are_renormalised(self, analysis_service: AnalysisService):
        result = analysis_service.run_full_analysis(
            sample_resume_pdf(), sample_jd_pdf(),
            resume_filename="resume.pdf", jd_filename="jd.pdf",
            weights={key: 2.0 for key in settings.score_weights},
        )
        total = sum(
            component.weight for component in (
                result.score_breakdown.keyword_match, result.score_breakdown.semantic_similarity,
                result.score_breakdown.skill_match, result.score_breakdown.experience_relevance,
                result.score_breakdown.education_match,
            )
        )
        assert total == pytest.approx(1.0)

    def test_top_keywords_limits_the_lists(self, analysis_service: AnalysisService):
        result = analysis_service.run_full_analysis(
            sample_resume_pdf(), sample_jd_pdf(),
            resume_filename="resume.pdf", jd_filename="jd.pdf", top_keywords=8,
        )
        assert len(result.keyword_analysis.top_jd_keywords) <= 8

    def test_default_top_keywords_comes_from_settings(self, analysis_result: AnalysisResponse):
        assert len(analysis_result.keyword_analysis.top_jd_keywords) <= settings.top_keywords

    def test_repeated_runs_are_deterministic(self, analysis_service: AnalysisService):
        first = analysis_service.run_full_analysis(
            sample_resume_pdf(), sample_jd_pdf(), resume_filename="r.pdf", jd_filename="j.pdf"
        )
        second = analysis_service.run_full_analysis(
            sample_resume_pdf(), sample_jd_pdf(), resume_filename="r.pdf", jd_filename="j.pdf"
        )
        assert first.overall_score == pytest.approx(second.overall_score, abs=0.01)
        assert first.grade == second.grade
        assert set(first.skills_analysis.matched) == set(second.skills_analysis.matched)

    def test_each_run_gets_a_unique_id(self, analysis_service: AnalysisService, analysis_result):
        other = analysis_service.run_full_analysis(
            build_pdf(SAMPLE_RESUME_TEXT), build_pdf(SAMPLE_JD_TEXT),
            resume_filename="r.pdf", jd_filename="j.pdf",
        )
        assert other.id != analysis_result.id
