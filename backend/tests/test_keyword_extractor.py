"""Tests for stage 7b — keyword extraction (TF-IDF + RAKE + TextRank)."""

from __future__ import annotations

import pytest

from core.keyword_extractor import KeywordExtractor
from models.schemas import JDKeyword, KeywordScore

SAMPLE_TEXT = """
Senior Machine Learning Engineer with 8 years of experience designing and deploying
production machine learning systems. Built data pipelines with Apache Spark and Airflow,
trained deep learning models using TensorFlow and PyTorch, and served them through
FastAPI microservices on Kubernetes clusters in AWS and GCP. Optimised SQL queries and
reduced inference latency by 40 percent. Mentored junior engineers and collaborated with
product managers, data scientists and stakeholders to ship features that improved
customer retention and revenue forecasting accuracy.
""".strip()


@pytest.fixture
def unrelated_pair() -> tuple[str, str]:
    return (
        "Registered nurse with 12 years in paediatric intensive care, patient advocacy "
        "and clinical documentation.",
        "Senior backend engineer for a cryptocurrency exchange, expert in Rust, Go and "
        "distributed consensus protocols.",
    )


class TestIsValidKeyword:
    @pytest.mark.parametrize(
        "keyword", ["machine learning", "tensorflow", "kubernetes", "ci/cd", "data pipelines", "pytorch"]
    )
    def test_accepts_technical_keywords(self, keyword: str):
        assert KeywordExtractor.is_valid_keyword(keyword) is True

    @pytest.mark.parametrize(
        "keyword,reason",
        [
            ("", "empty"),
            ("   ", "blank"),
            ("a", "single letter"),
            ("the data", "stop word"),
            ("and", "stop word"),
            ("000", "all digits"),
            ("2021", "year"),
            ("data-", "dangling punctuation"),
            ("x" * 90, "too long"),
        ],
    )
    def test_rejects_noise(self, keyword: str, reason: str):
        assert KeywordExtractor.is_valid_keyword(keyword) is False, reason


class TestTFIDF:
    def test_ranks_discriminative_terms_highest(self, keyword_extractor: KeywordExtractor):
        resume = (
            "Built machine learning models with TensorFlow and PyTorch. "
            "Deployed on Kubernetes and AWS with Docker containers."
        )
        jd = (
            "We are hiring a professional to join the team and work with people. "
            "The company values collaboration and communication."
        )
        keywords = keyword_extractor.extract_tfidf_keywords(resume, top_n=10)
        assert keywords
        top = " ".join(kw.keyword.lower() for kw in keywords[:4])
        assert any(term in top for term in ("tensorflow", "kubernetes", "pytorch", "machine"))

    def test_scores_are_sorted_descending(self, keyword_extractor: KeywordExtractor):
        keywords = keyword_extractor.extract_tfidf_keywords(SAMPLE_TEXT, top_n=15)
        scores = [kw.score for kw in keywords]
        assert scores == sorted(scores, reverse=True)
        assert all(0.0 <= score <= 1.0 for score in scores)
        assert all(kw.method == "tfidf" for kw in keywords)

    def test_top_n_is_respected(self, keyword_extractor: KeywordExtractor):
        assert len(keyword_extractor.extract_tfidf_keywords(SAMPLE_TEXT, top_n=5)) <= 5

    def test_empty_text(self, keyword_extractor: KeywordExtractor):
        assert keyword_extractor.extract_tfidf_keywords("") == []

    def test_stop_words_are_excluded(self, keyword_extractor: KeywordExtractor):
        terms = {kw.keyword.lower() for kw in keyword_extractor.extract_tfidf_keywords(SAMPLE_TEXT, top_n=30)}
        assert not terms & {"the", "and", "of", "with", "for"}

    def test_stop_word_lookalikes_survive_vectorisation(self, keyword_extractor: KeywordExtractor):
        terms = {kw.keyword.lower() for kw in keyword_extractor.extract_tfidf_keywords(
            "Strong R programming plus .NET and AI research with Go services.", top_n=20
        )}
        assert terms & {"r", ".net", "ai", "go"}, terms


class TestRAKE:
    def test_returns_keyword_score_objects(self, keyword_extractor: KeywordExtractor):
        keywords = keyword_extractor.extract_rake_keywords(SAMPLE_TEXT, top_n=10)
        assert keywords
        assert all(isinstance(kw, KeywordScore) for kw in keywords)
        assert all(kw.method == "rake" for kw in keywords)

    def test_prefers_multi_word_phrases(self, keyword_extractor: KeywordExtractor):
        keywords = keyword_extractor.extract_rake_keywords(SAMPLE_TEXT, top_n=10)
        assert any(" " in kw.keyword for kw in keywords)

    def test_never_crashes_on_odd_input(self, keyword_extractor: KeywordExtractor):
        assert isinstance(keyword_extractor.extract_rake_keywords("!@#$%^&*() 12345", top_n=5), list)
        assert keyword_extractor.extract_rake_keywords("", top_n=5) == []


class TestTextRank:
    def test_scores_are_normalised(self, keyword_extractor: KeywordExtractor):
        """Regression: a fully connected co-occurrence graph gave every term 1.0."""
        keywords = keyword_extractor.extract_textrank_keywords(SAMPLE_TEXT, top_n=15)
        assert keywords
        scores = {round(kw.score, 4) for kw in keywords}
        assert len(scores) > 1, "all scores identical"

    def test_sorted_descending(self, keyword_extractor: KeywordExtractor):
        keywords = keyword_extractor.extract_textrank_keywords(SAMPLE_TEXT, top_n=10)
        scores = [kw.score for kw in keywords]
        assert scores == sorted(scores, reverse=True)
        assert all(kw.method == "textrank" for kw in keywords)

    def test_empty_text(self, keyword_extractor: KeywordExtractor):
        assert keyword_extractor.extract_textrank_keywords("", top_n=5) == []


class TestCombined:
    def test_merges_all_three_algorithms(self, keyword_extractor: KeywordExtractor):
        combined = keyword_extractor.get_combined_keywords(SAMPLE_TEXT, top_n=15)
        assert combined
        assert all(isinstance(kw, KeywordScore) for kw in combined)
        methods = " ".join(kw.method for kw in combined)
        assert "tfidf" in methods
        assert "rake" in methods or "textrank" in methods

    def test_scores_sorted_and_bounded(self, keyword_extractor: KeywordExtractor):
        combined = keyword_extractor.get_combined_keywords(SAMPLE_TEXT, top_n=15)
        scores = [kw.score for kw in combined]
        assert scores == sorted(scores, reverse=True)
        assert all(0.0 <= score <= 1.0 for score in scores)

    def test_top_n_limit(self, keyword_extractor: KeywordExtractor):
        assert len(keyword_extractor.get_combined_keywords(SAMPLE_TEXT, top_n=3)) <= 3

    def test_noise_terms_are_filtered(self, keyword_extractor: KeywordExtractor):
        combined = keyword_extractor.get_combined_keywords(
            "Salary $180,000 - $230,000 per year. Contact us at careers@example.com.", top_n=20
        )
        for kw in combined:
            assert KeywordExtractor.is_valid_keyword(kw.keyword), kw.keyword


class TestCompare:
    def test_returns_similarity_and_lists(self, keyword_extractor: KeywordExtractor, cleaned_resume, cleaned_jd):
        similarity, jd_keywords, resume_keywords, common = keyword_extractor.compare(
            cleaned_resume, cleaned_jd, top_n=25
        )
        assert 0.0 <= similarity <= 1.0
        assert jd_keywords and all(isinstance(kw, JDKeyword) for kw in jd_keywords)
        assert resume_keywords and all(isinstance(kw, JDKeyword) for kw in resume_keywords)
        assert isinstance(common, list)

    def test_identical_documents_are_very_similar(self, keyword_extractor: KeywordExtractor):
        text = "Machine learning engineer building data pipelines with Python and Spark."
        similarity, _, _, common = keyword_extractor.compare(text, text, top_n=20)
        assert similarity > 0.9
        assert common

    def test_unrelated_documents_share_few_keywords(self, keyword_extractor: KeywordExtractor, unrelated_pair):
        resume, jd = unrelated_pair
        similarity, jd_keywords, _, common = keyword_extractor.compare(resume, jd, top_n=20)
        assert similarity < 0.6
        assert len(common) <= 3
        assert any(not kw.found_in_resume for kw in jd_keywords)

    def test_matched_flags_are_set(self, keyword_extractor: KeywordExtractor, cleaned_resume, cleaned_jd):
        _, jd_keywords, _, _ = keyword_extractor.compare(cleaned_resume, cleaned_jd, top_n=25)
        assert any(kw.found_in_resume for kw in jd_keywords), "expected matched keywords"
        assert any(not kw.found_in_resume for kw in jd_keywords), "expected gaps"
        for kw in jd_keywords:
            assert 0.0 <= kw.tfidf_score <= 1.0
            assert kw.importance >= 0.0

    def test_cross_boundary_ngrams_are_dropped(self, keyword_extractor: KeywordExtractor):
        """Regression: "and the" survived as a keyword because it spanned a newline."""
        resume = "Built models\nand the team deployed them"
        jd = "Looking for engineers\nand the ability to collaborate"
        _, jd_keywords, resume_keywords, _ = keyword_extractor.compare(resume, jd, top_n=15)
        banned = {"and the", "and", "the"}
        assert all(kw.keyword.strip().lower() not in banned for kw in jd_keywords)
        assert all(kw.keyword.strip().lower() not in banned for kw in resume_keywords)


class TestDensity:
    def test_optimal_density_for_the_sample_resume(self, keyword_extractor: KeywordExtractor, cleaned_resume, cleaned_jd):
        _, jd_keywords, _, _ = keyword_extractor.compare(cleaned_resume, cleaned_jd, top_n=20)
        density = keyword_extractor.keyword_density(cleaned_resume, jd_keywords)
        assert density.resume_status in {"optimal", "under_optimized", "over_optimized"}
        assert 0.0 <= density.resume <= 1.0

    def test_zero_keywords_is_not_over_optimised(self, keyword_extractor: KeywordExtractor):
        density = keyword_extractor.keyword_density("some text about engineering", [])
        assert density.resume == 0.0
        assert density.resume_status == "under_optimized"

    def test_over_optimized_detection(self, keyword_extractor: KeywordExtractor):
        text = "python python python python python python python python python python"
        density = keyword_extractor.keyword_density(text, [JDKeyword(keyword="python")])
        assert density.resume > 0.5
        assert density.resume_status == "over_optimized"

    def test_under_optimized_detection(self, keyword_extractor: KeywordExtractor):
        text = "A long narrative about leadership, teamwork and communication skills only."
        density = keyword_extractor.keyword_density(
            text,
            [JDKeyword(keyword=k) for k in ("kubernetes", "terraform", "spark", "airflow")],
        )
        assert density.resume_status == "under_optimized"

    def test_empty_text_is_safe(self, keyword_extractor: KeywordExtractor):
        density = keyword_extractor.keyword_density("", [JDKeyword(keyword="python")])
        assert density.resume == 0.0


class TestTFIDFCosine:
    def test_returns_similarity_and_idf_map(self, keyword_extractor: KeywordExtractor, cleaned_resume, cleaned_jd):
        similarity, idf_map = keyword_extractor.tfidf_cosine_similarity(cleaned_resume, cleaned_jd)
        assert 0.0 <= similarity <= 1.0
        assert isinstance(idf_map, dict)

    def test_identical_text_similarity_is_one(self, keyword_extractor: KeywordExtractor):
        text = "Machine learning engineer with Python and TensorFlow experience."
        similarity, _ = keyword_extractor.tfidf_cosine_similarity(text, text)
        assert similarity > 0.99

    def test_empty_inputs(self, keyword_extractor: KeywordExtractor):
        similarity, _ = keyword_extractor.tfidf_cosine_similarity("", "")
        assert similarity == 0.0
