"""Tests for stage 9/10 — vectorisation and semantic similarity.

The sandbox has no sentence-transformers weights, so these tests assert
*invariants* that hold for both the transformer and the LSA fallback rather
than exact similarity values.
"""

from __future__ import annotations

import numpy as np
import pytest

from core.semantic_analyzer import LSAEncoder, SemanticAnalyzer, cosine


class TestCosine:
    def test_identical_vectors(self):
        vector = np.array([1.0, 2.0, 3.0])
        assert cosine(vector, vector) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        assert cosine(np.array([1.0, 0.0]), np.array([0.0, 1.0])) == pytest.approx(0.0)

    def test_opposite_vectors_are_clamped_to_zero(self):
        assert cosine(np.array([1.0, 1.0]), np.array([-1.0, -1.0])) == pytest.approx(0.0)

    @pytest.mark.parametrize("a,b", [(np.zeros(3), np.array([1.0, 2.0, 3.0])), (np.zeros(3), np.zeros(3))])
    def test_zero_vectors_are_safe(self, a, b):
        assert cosine(a, b) == 0.0

    def test_mismatched_lengths_are_safe(self):
        assert cosine(np.array([1.0, 2.0]), np.array([1.0, 2.0, 3.0])) == 0.0

    def test_result_is_always_in_range(self):
        rng = np.random.default_rng(7)
        for _ in range(20):
            value = cosine(rng.normal(size=64), rng.normal(size=64))
            assert 0.0 <= value <= 1.0


class TestLSAEncoder:
    CORPUS = [
        "Machine learning engineers build models with Python and TensorFlow.",
        "Data pipelines are orchestrated with Airflow and Spark on Kubernetes.",
        "Nurses provide patient care in intensive care units and document outcomes.",
        "Cloud infrastructure is provisioned with Terraform and AWS services.",
    ]

    def test_fit_then_encode(self):
        encoder = LSAEncoder()
        assert encoder.is_fitted is False
        encoder.fit(self.CORPUS)
        assert encoder.is_fitted is True
        vectors = encoder.encode(self.CORPUS)
        assert vectors.shape[0] == len(self.CORPUS)

    def test_similar_documents_score_higher_than_unrelated(self):
        encoder = LSAEncoder()
        encoder.fit(self.CORPUS)
        vectors = encoder.encode(self.CORPUS)
        related = cosine(vectors[0], vectors[1])     # ML vs data engineering
        unrelated = cosine(vectors[0], vectors[2])   # ML vs nursing
        assert related >= unrelated

    def test_self_similarity_is_maximal(self):
        encoder = LSAEncoder()
        encoder.fit(self.CORPUS)
        vectors = encoder.encode(self.CORPUS)
        for idx in range(len(self.CORPUS)):
            self_sim = cosine(vectors[idx], vectors[idx])
            assert self_sim >= cosine(vectors[idx], vectors[(idx + 1) % len(self.CORPUS)]) - 1e-9

    def test_encode_before_fit_degrades_gracefully(self):
        """Unfitted encoders return zero vectors instead of raising."""
        encoder = LSAEncoder()
        vectors = encoder.encode(["anything", "else"])
        assert vectors.shape[0] == 2
        assert np.all(np.isfinite(vectors))
        assert float(np.abs(vectors).sum()) == 0.0

    def test_unknown_words_do_not_crash(self):
        encoder = LSAEncoder()
        encoder.fit(self.CORPUS)
        vectors = encoder.encode(["zzz qqq zyxwvut entirely unseen vocabulary"])
        assert vectors.shape[0] == 1
        assert np.all(np.isfinite(vectors))


class TestSemanticAnalyzer:
    def test_variant_is_reported(self, semantic_analyzer: SemanticAnalyzer):
        assert semantic_analyzer.variant in {"transformer", "lsa"}
        assert semantic_analyzer.model_name

    def test_compute_similarity_is_bounded(self, semantic_analyzer: SemanticAnalyzer, cleaned_resume, cleaned_jd):
        value = semantic_analyzer.compute_semantic_similarity(cleaned_resume, cleaned_jd)
        assert 0.0 <= value <= 1.0

    def test_related_pair_beats_unrelated_pair(self, semantic_analyzer: SemanticAnalyzer, cleaned_resume, cleaned_jd):
        unrelated_jd = (
            "Registered nurse for a paediatric intensive care unit. Responsibilities "
            "include patient assessment, medication administration and family support."
        )
        related = semantic_analyzer.compute_semantic_similarity(cleaned_resume, cleaned_jd)
        unrelated = semantic_analyzer.compute_semantic_similarity(cleaned_resume, unrelated_jd)
        assert related >= unrelated

    def test_self_similarity_is_high(self, semantic_analyzer: SemanticAnalyzer, cleaned_resume):
        value = semantic_analyzer.compute_semantic_similarity(cleaned_resume, cleaned_resume)
        assert value > 0.8

    def test_empty_inputs_are_safe(self, semantic_analyzer: SemanticAnalyzer):
        assert semantic_analyzer.compute_semantic_similarity("", "") == 0.0
        assert semantic_analyzer.compute_semantic_similarity("python", "") == 0.0

    def test_encode_texts_shape(self, semantic_analyzer: SemanticAnalyzer, cleaned_resume, cleaned_jd):
        vectors = semantic_analyzer.encode_texts(
            [cleaned_resume, cleaned_jd], fit_corpus=[cleaned_resume, cleaned_jd]
        )
        assert vectors.shape[0] == 2
        assert np.all(np.isfinite(vectors))

    def test_embed_matches_encode_texts(self, semantic_analyzer: SemanticAnalyzer):
        texts = ["machine learning engineer", "data scientist", "nurse"]
        a = semantic_analyzer.embed(texts)
        b = semantic_analyzer.encode_texts(texts, fit_corpus=texts)
        assert a.shape == b.shape

    def test_pairwise_similarity(self, semantic_analyzer: SemanticAnalyzer):
        value = semantic_analyzer.pairwise_similarity(
            "Senior machine learning engineer building recommendation systems.",
            "We are hiring a machine learning engineer for recommendations.",
        )
        assert 0.0 <= value <= 1.0

    def test_section_similarities(self, semantic_analyzer: SemanticAnalyzer, resume_sections, cleaned_jd):
        texts = {name: info.text for name, info in resume_sections.items() if info.text}
        result = semantic_analyzer.compute_section_similarities(texts, cleaned_jd)
        assert set(result) == set(texts)
        assert all(0.0 <= value <= 1.0 for value in result.values())

    def test_section_similarities_with_empty_jd(self, semantic_analyzer: SemanticAnalyzer):
        result = semantic_analyzer.compute_section_similarities({"skills": "Python"}, "")
        assert result == {"skills": 0.0}

    def test_repeat_calls_are_stable_and_cache_clearing_is_safe(self, semantic_analyzer: SemanticAnalyzer, cleaned_jd, cleaned_resume):
        first = semantic_analyzer.compute_semantic_similarity(cleaned_resume, cleaned_jd)
        second = semantic_analyzer.compute_semantic_similarity(cleaned_resume, cleaned_jd)
        assert first == pytest.approx(second)
        semantic_analyzer.clear_cache()
        third = semantic_analyzer.compute_semantic_similarity(cleaned_resume, cleaned_jd)
        assert third == pytest.approx(first)

    def test_lsa_never_returns_degenerate_ones(self, semantic_analyzer: SemanticAnalyzer):
        """Regression: fitting LSA on exactly 2 documents gave cosine == 1.0."""
        a = semantic_analyzer.compute_semantic_similarity(
            "Machine learning engineer with Python and TensorFlow experience.",
            "Registered nurse providing bedside care in a hospital ward.",
        )
        assert a < 0.95
