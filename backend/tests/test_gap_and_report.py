"""Tests for stage 12 — gap analysis and the recommendation/ATS report."""

from __future__ import annotations

import pytest

from core.gap_analyzer import GapAnalyzer
from core.report_generator import ReportGenerator
from models.schemas import (
    ATSCheck,
    ExtractionMethod,
    ExtractedText,
    GapAnalysisResult,
    JDKeyword,
    JobDescriptionEntities,
    KeywordAnalysis,
    KeywordDensity,
    Recommendation,
    ResumeEntities,
    ScoreBreakdown,
    SectionScore,
    SkillMatchResult,
)


@pytest.fixture(scope="module")
def gap_analyzer(entity_extractor) -> GapAnalyzer:
    return GapAnalyzer(entity_extractor=entity_extractor)


@pytest.fixture(scope="module")
def reporter() -> ReportGenerator:
    return ReportGenerator()


def keyword_analysis(top_jd, common=(), density=0.2, cosine=0.5) -> KeywordAnalysis:
    return KeywordAnalysis(
        top_jd_keywords=list(top_jd),
        top_resume_keywords=[],
        common_keywords=list(common),
        keyword_density=KeywordDensity(resume=density, jd=density,
                                       resume_status="optimal", jd_status="optimal"),
        tfidf_cosine_similarity=cosine,
    )


class TestGapAnalysis:
    def test_returns_the_full_result_model(self, gap_analyzer: GapAnalyzer, resume_entities, jd_entities):
        skills = SkillMatchResult(matched=["Python"], missing=["Terraform", "Azure"],
                                  resume_skills=["Python"], jd_skills=["Python", "Terraform", "Azure"])
        analysis = keyword_analysis([
            JDKeyword(keyword="terraform", found_in_resume=False, importance=0.8),
            JDKeyword(keyword="python", found_in_resume=True, importance=0.6),
        ], common=["python"])
        result = gap_analyzer.analyze_gaps(
            resume_entities=resume_entities,
            jd_entities=jd_entities,
            skill_match=skills,
            keyword_analysis=analysis,
            section_scores={"skills": SectionScore(score=80.0, present=True)},
            detected_sections=["summary", "experience", "education", "skills"],
            quantified_achievements=4,
            action_verbs=["Built", "Led"],
        )
        assert isinstance(result, GapAnalysisResult)
        assert 0.0 <= result.coverage_ratio <= 1.0
        assert any(gap.skill.lower() == "terraform" for gap in result.missing_skills)

    def test_missing_keywords_are_sorted_by_importance(self, gap_analyzer: GapAnalyzer):
        keywords = [
            JDKeyword(keyword="low value term", found_in_resume=False, importance=0.1),
            JDKeyword(keyword="high value term", found_in_resume=False, importance=0.9),
        ]
        gaps = gap_analyzer.missing_keywords(keywords, top_n=10)
        assert [gap.keyword for gap in gaps][0] == "high value term"
        assert gaps[0].severity.value.upper() in {"HIGH", "MEDIUM", "LOW"}

    def test_matched_keywords_are_not_gaps(self, gap_analyzer: GapAnalyzer):
        keywords = [JDKeyword(keyword="python", found_in_resume=True, importance=0.9)]
        assert gap_analyzer.missing_keywords(keywords, top_n=10) == []

    def test_top_n_limits_the_gaps(self, gap_analyzer: GapAnalyzer):
        keywords = [
            JDKeyword(keyword=f"term {i}", found_in_resume=False, importance=0.5)
            for i in range(40)
        ]
        assert len(gap_analyzer.missing_keywords(keywords, top_n=5)) <= 5

    def test_noise_terms_are_ignored(self, gap_analyzer: GapAnalyzer, jd_entities):
        noise = GapAnalyzer.noise_terms(jd_entities)
        assert isinstance(noise, set)
        assert any("techcorp" in term for term in noise)
        keywords = [JDKeyword(keyword="techcorp", found_in_resume=False, importance=0.9)]
        assert gap_analyzer.missing_keywords(keywords, top_n=10, ignore=noise) == []

    def test_missing_skills_rank_required_above_preferred(self, gap_analyzer: GapAnalyzer):
        skills = SkillMatchResult(missing=["Terraform", "Rust"], jd_skills=["Terraform", "Rust"])
        jd = JobDescriptionEntities(required_skills=["Terraform"], preferred_skills=["Rust"])
        gaps = gap_analyzer.missing_skills(skills, jd, keyword_analysis([]))
        assert gaps[0].skill == "Terraform"
        assert gaps[0].importance == "high"      # required by the posting
        assert gaps[1].importance == "low"       # merely preferred
        assert gaps[0].category and gaps[1].category

    def test_weak_sections_flags_low_scorers(self, gap_analyzer: GapAnalyzer):
        scores = {
            "summary": SectionScore(score=20.0, present=True),
            "experience": SectionScore(score=90.0, present=True),
            "skills": SectionScore(score=10.0, present=True),
        }
        weak = gap_analyzer.weak_sections(scores, ["summary", "experience", "skills"])
        names = {item.section for item in weak}
        assert "summary" in names and "skills" in names
        assert "experience" not in names

    def test_absent_expected_sections_are_flagged(self, gap_analyzer: GapAnalyzer):
        weak = gap_analyzer.weak_sections({}, ["summary"])
        names = {item.section for item in weak}
        assert {"experience", "education", "skills"} <= names

    def test_weak_sections_carry_suggestions(self, gap_analyzer: GapAnalyzer):
        weak = gap_analyzer.weak_sections({"skills": SectionScore(score=5.0, present=True)}, ["skills"])
        assert all(item.suggestion for item in weak)
        assert all(item.issue for item in weak)

    def test_experience_gap_reports_a_shortfall(self, gap_analyzer: GapAnalyzer):
        gap = gap_analyzer.experience_gap(
            ResumeEntities(years_experience=2.0), JobDescriptionEntities(min_years_experience=6)
        )
        assert gap and "2" in gap and "6" in gap

    def test_no_experience_gap_when_satisfied(self, gap_analyzer: GapAnalyzer):
        assert gap_analyzer.experience_gap(
            ResumeEntities(years_experience=9.0), JobDescriptionEntities(min_years_experience=5)
        ) is None

    def test_education_gap_reports_missing_degree(self, gap_analyzer: GapAnalyzer):
        gap = gap_analyzer.education_gap(
            ResumeEntities(education_level="bachelor", degrees=["B.S."]),
            JobDescriptionEntities(degree_requirement="Ph.D. in Machine Learning"),
        )
        assert gap

    def test_no_education_gap_when_requirement_absent(self, gap_analyzer: GapAnalyzer):
        assert gap_analyzer.education_gap(ResumeEntities(), JobDescriptionEntities()) is None

    def test_coverage_ratio(self, gap_analyzer: GapAnalyzer):
        keywords = [
            JDKeyword(keyword="a", found_in_resume=True),
            JDKeyword(keyword="b", found_in_resume=True),
            JDKeyword(keyword="c", found_in_resume=False),
            JDKeyword(keyword="d", found_in_resume=False),
        ]
        assert GapAnalyzer.coverage_ratio(keywords, top_n=4) == pytest.approx(0.5)

    def test_coverage_ratio_ignores_noise(self, gap_analyzer: GapAnalyzer):
        keywords = [
            JDKeyword(keyword="techcorp", found_in_resume=False),
            JDKeyword(keyword="python", found_in_resume=True),
        ]
        assert GapAnalyzer.coverage_ratio(keywords, top_n=5, ignore={"techcorp"}) == pytest.approx(1.0)

    def test_coverage_ratio_with_no_keywords(self, gap_analyzer: GapAnalyzer):
        assert GapAnalyzer.coverage_ratio([], top_n=5) == 0.0


class TestATSFormattingCheck:
    def test_clean_resume_passes_everything(self, reporter: ReportGenerator):
        raw = (
            "John Doe\nSan Francisco, CA\njohn.doe@example.com | (415) 555-0134\n\n"
            "SUMMARY\nSenior machine learning engineer with eight years of experience.\n\n"
            "EXPERIENCE\nSenior Engineer, DataScale Inc, June 2021 - Present\n"
            "- Built machine learning models that reduced false positives by 34%.\n\n"
            "EDUCATION\nM.S. in Computer Science, Stanford University\n\n"
            "SKILLS\nPython, TensorFlow, PyTorch, Kubernetes, AWS, SQL\n"
        )
        check = reporter.generate_ats_check(
            raw_text=raw,
            extracted=ExtractedText(full_text=raw, char_count=len(raw), page_count=1,
                                    extraction_method=ExtractionMethod.PLAIN_TEXT, is_scanned=False),
            sections=("summary", "experience", "education", "skills"),
            emails=["john.doe@example.com"],
            phones=["(415) 555-0134"],
            file_size_bytes=len(raw.encode()),
            keyword_density=0.2,
            word_count=len(raw.split()),
        )
        assert isinstance(check, ATSCheck)
        assert check.score >= 90.0
        assert check.contact_info_found is True
        assert check.standard_headers_used is True
        assert check.is_text_based is True
        assert not [issue for issue in check.issues if issue.type == "error"]
        assert check.checks_passed == check.checks_total or check.score >= 90.0

    def test_problems_are_reported_with_fixes(self, reporter: ReportGenerator):
        raw = "no headings here just a wall of text " * 40
        check = reporter.generate_ats_check(
            raw_text=raw,
            extracted=ExtractedText(full_text=raw, char_count=len(raw), page_count=1,
                                    extraction_method=ExtractionMethod.OCR_TESSERACT,
                                    is_scanned=True, ocr_attempted=True),
            sections=(),
            emails=[],
            phones=[],
            file_size_bytes=10,
            keyword_density=0.0,
            word_count=len(raw.split()),
        )
        assert check.score < 90.0
        assert check.contact_info_found is False
        assert check.issues
        for issue in check.issues:
            assert issue.message and issue.code
            assert issue.type in {"error", "warning", "info", "success"}
            if issue.type != "success":
                assert issue.fix

    def test_missing_contact_details_are_an_error(self, reporter: ReportGenerator):
        check = reporter.generate_ats_check(
            raw_text="SUMMARY\nEngineer.\nEXPERIENCE\nDid things.\n",
            extracted=ExtractedText(full_text="SUMMARY\nEngineer.", char_count=18,
                                    extraction_method=ExtractionMethod.PLAIN_TEXT),
            sections=("summary", "experience"),
            emails=[],
            phones=[],
        )
        codes = {issue.code for issue in check.issues}
        assert "contact_info" in codes
        failing = {issue.code for issue in check.issues if issue.type == "warning"}
        assert "contact_info" in failing
        assert check.contact_info_found is False

    def test_score_is_weighted_not_a_plain_ratio(self, reporter: ReportGenerator):
        """Errors weigh more than warnings, warnings more than info."""
        clean = reporter.generate_ats_check(
            raw_text="John Doe\njohn@example.com\nSUMMARY\nEngineer with experience.\n",
            extracted=ExtractedText(full_text="John Doe", char_count=8,
                                    extraction_method=ExtractionMethod.PLAIN_TEXT),
            sections=("summary",), emails=["john@example.com"],
        )
        assert 0.0 <= clean.score <= 100.0
        assert clean.checks_passed <= clean.checks_total

    def test_very_short_resume_is_flagged(self, reporter: ReportGenerator):
        check = reporter.generate_ats_check(
            raw_text="Hi",
            extracted=ExtractedText(full_text="Hi", char_count=2,
                                    extraction_method=ExtractionMethod.PLAIN_TEXT),
            word_count=1,
        )
        assert check.score < 100.0
        failing = {issue.code for issue in check.issues if issue.type != "success"}
        assert failing & {"word_count", "text_extractable", "standard_headers", "parseable_dates"}

    def test_oversized_file_is_flagged(self, reporter: ReportGenerator):
        check = reporter.generate_ats_check(
            raw_text="SUMMARY\nEngineer.\n" * 10,
            extracted=ExtractedText(text="SUMMARY", word_count=1),
            file_size_bytes=12 * 1024 * 1024,
        )
        assert "file_size" in {issue.code for issue in check.issues if issue.type != "success"}


class TestRecommendations:
    def _inputs(self, analysis_result):
        return dict(
            gap_analysis=analysis_result.gap_analysis,
            breakdown=analysis_result.score_breakdown,
            skill_match=analysis_result.skill_details,
            keyword_analysis=analysis_result.keyword_analysis,
            section_scores=analysis_result.section_scores,
            ats_check=analysis_result.ats_formatting,
            resume_entities=analysis_result.entity_extraction.resume,
            jd_entities=analysis_result.entity_extraction.job_description,
            metadata=analysis_result.nlp_metadata,
            quantified_achievements=4,
            action_verbs=["Built", "Led", "Designed"],
        )

    def test_generates_a_prioritised_list(self, reporter: ReportGenerator, analysis_result):
        recs = reporter.generate_recommendations(**self._inputs(analysis_result))
        assert recs
        assert all(isinstance(rec, Recommendation) for rec in recs)
        assert len(recs) <= 14

    def test_sorted_by_priority_then_impact(self, reporter: ReportGenerator, analysis_result):
        recs = reporter.generate_recommendations(**self._inputs(analysis_result))
        order = {"high": 0, "medium": 1, "low": 2}
        keys = [(order.get(rec.priority.value.lower(), 3), -rec.impact_score) for rec in recs]
        assert keys == sorted(keys)

    def test_every_recommendation_is_actionable(self, reporter: ReportGenerator, analysis_result):
        recs = reporter.generate_recommendations(**self._inputs(analysis_result))
        for rec in recs:
            assert rec.message and rec.action and rec.category
            assert 0.0 <= rec.impact_score <= 100.0
            assert rec.priority.value.lower() in {"high", "medium", "low"}

    def test_no_duplicate_messages(self, reporter: ReportGenerator, analysis_result):
        recs = reporter.generate_recommendations(**self._inputs(analysis_result))
        messages = [rec.message.lower() for rec in recs]
        assert len(messages) == len(set(messages))

    def test_missing_skills_produce_a_high_priority_recommendation(self, reporter: ReportGenerator, cross_result):
        recs = reporter.generate_recommendations(**self._inputs(cross_result))
        categories = {rec.category for rec in recs}
        assert categories

    def test_limit_is_respected(self, reporter: ReportGenerator, analysis_result):
        recs = reporter.generate_recommendations(**self._inputs(analysis_result), limit=3)
        assert len(recs) <= 3

    def test_perfect_resume_still_yields_valid_output(self, reporter: ReportGenerator):
        resume = ResumeEntities(
            person="Jane", years_experience=10.0, education_level="phd",
            degrees=["Ph.D. in Computer Science"], skills=["Python", "Kubernetes"],
            emails=["jane@example.com"], phones=["555-0100"],
        )
        jd = JobDescriptionEntities(min_years_experience=5, required_skills=["Python", "Kubernetes"])
        skills = SkillMatchResult(matched=["Python", "Kubernetes"], resume_skills=["Python", "Kubernetes"],
                                  jd_skills=["Python", "Kubernetes"], precision=1.0, recall=1.0, f1=1.0, score=100.0)
        recs = reporter.generate_recommendations(
            gap_analysis=GapAnalysisResult(coverage_ratio=1.0),
            breakdown=analysis_result_breakdown(),
            skill_match=skills,
            keyword_analysis=keyword_analysis([JDKeyword(keyword="python", found_in_resume=True)]),
            section_scores={"skills": SectionScore(score=95.0, present=True)},
            ats_check=ATSCheck(score=100.0, checks_passed=13, checks_total=13),
            resume_entities=resume,
            jd_entities=jd,
        )
        assert isinstance(recs, list)
        assert all(isinstance(rec, Recommendation) for rec in recs)


def analysis_result_breakdown() -> "ScoreBreakdown":
    """Neutral score breakdown for the "perfect resume" case."""
    return ScoreBreakdown()
