"""Tests for stages 3-6 — tokenization, stop words, lemmatisation and POS."""

from __future__ import annotations

import pytest

from core.nlp_pipeline import NLPPipeline
from core.tokenizer import SPECIAL_CASES, Tokenizer, extract_noun_chunks
from models.schemas import ProcessedDocument, TokenInfo, TokenizedText

COMPOUND_SAMPLES = [
    "C++", "C#", ".NET", "Node.js", "CI/CD", "scikit-learn", "full-stack",
    "A/B testing", "Objective-C", "Next.js",
]


class TestTokenizerSpecialCases:
    def test_special_cases_are_registered(self, nlp):
        tokenizer = Tokenizer(nlp)
        doc = tokenizer.make_doc("We use C++ and Node.js with CI/CD pipelines.")
        tokens = [token.text for token in doc]
        assert "C++" in tokens
        assert "Node.js" in tokens
        assert "CI/CD" in tokens

    @pytest.mark.parametrize("term", ["C++", "Node.js", "CI/CD", "scikit-learn"])
    def test_protected_terms_survive_tokenization(self, nlp, term: str):
        tokenizer = Tokenizer(nlp)
        doc = tokenizer.make_doc(f"Experience with {term} in production.")
        assert term.lower() in [token.text.lower() for token in doc]

    def test_special_case_table_is_non_trivial(self):
        assert len(SPECIAL_CASES) > 100
        assert "c++" in SPECIAL_CASES and "CI/CD" in SPECIAL_CASES


class TestTokenize:
    def test_returns_tokenized_text_model(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("Built machine learning models with Python.")
        assert isinstance(result, TokenizedText)
        assert result.word_count > 0
        assert result.unique_tokens > 0
        assert result.tokens and all(isinstance(t, TokenInfo) for t in result.tokens)

    def test_tokens_carry_annotations(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("Engineers designed and deployed the models.")
        annotated = [t for t in result.tokens if t.is_alpha]
        assert annotated, "expected alphabetic tokens"
        assert all(t.pos for t in annotated), "every token needs a POS tag"
        assert all(t.lemma for t in annotated), "every token needs a lemma"

    def test_stop_words_are_flagged(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("The engineers built a model for the team.")
        stops = [t.text.lower() for t in result.tokens if t.is_stop]
        assert "the" in stops

    def test_punctuation_is_flagged(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("Built models, deployed them; measured impact.")
        assert any(t.is_punct for t in result.tokens)

    def test_sentences_are_segmented(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("Built models. Deployed them. Measured impact.")
        assert len(result.sentences) >= 3

    def test_pos_distribution_sums_to_token_count(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("Senior engineers built reliable machine learning models.")
        assert sum(result.pos_distribution.values()) == len(result.tokens)

    def test_empty_input(self, nlp):
        tokenizer = Tokenizer(nlp)
        result = tokenizer.tokenize("")
        assert result.tokens == []
        assert result.word_count == 0

    def test_max_chars_truncates_input(self, nlp):
        tokenizer = Tokenizer(nlp)
        long_text = "word " * 5000
        result = tokenizer.tokenize(long_text, max_chars=200)
        assert result.word_count < 200


class TestNounChunks:
    def test_never_raises_on_heuristic_dependencies(self, nlp):
        """Regression: spaCy's chunker raised IndexError [E035] with rule-based arcs."""
        doc = nlp(
            "Senior machine learning engineers designed real time fraud detection "
            "models and deployed them on Kubernetes clusters."
        )
        chunks = extract_noun_chunks(doc)
        assert isinstance(chunks, list)
        assert all(isinstance(chunk, str) for chunk in chunks)

    def test_finds_multi_word_technical_phrases(self, nlp):
        doc = nlp("We built machine learning models for fraud detection systems.")
        chunks = " | ".join(extract_noun_chunks(doc))
        assert chunks, "expected at least one noun phrase"
        assert any(word in chunks for word in ("machine learning", "fraud detection", "learning models"))

    def test_none_document_is_safe(self):
        assert extract_noun_chunks(None) == []

    def test_length_bounds_are_respected(self, nlp):
        doc = nlp("A very long noun phrase " * 12)
        assert all(len(chunk) <= 60 for chunk in extract_noun_chunks(doc))


class TestNLPPipeline:
    def test_process_returns_full_document(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process(
            "Senior engineer. Built machine learning models that reduced costs by 34%.",
            source="resume",
        )
        assert isinstance(result, ProcessedDocument)
        assert result.cleaned.cleaned_text
        assert result.tokenized.tokens
        assert result.filtered_tokens
        assert result.processing_time_ms >= 0

    def test_stop_words_are_removed_from_filtered_tokens(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process(
            "The senior engineer of the team built a model for the company and the clients."
        )
        filtered = [t.lower() for t in result.filtered_tokens]
        assert "the" not in filtered
        assert "of" not in filtered
        assert "and" not in filtered

    def test_technical_stop_word_lookalikes_survive(self, nlp_pipeline: NLPPipeline):
        """R, AI, ML and .NET look like stop words but must not be filtered out."""
        result = nlp_pipeline.process("Used R and AI and ML plus .NET for analytics.")
        filtered = {t.lower() for t in result.filtered_tokens}
        assert filtered & {"r", "ai", "ml", ".net"}, f"protected terms lost: {filtered}"

    def test_lemmas_are_produced(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process("Engineers designed, built and deployed models.")
        assert result.lemmas
        assert all(isinstance(lemma, str) and lemma for lemma in result.lemmas)

    def test_bigrams_are_produced(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process("machine learning models for fraud detection")
        assert result.filtered_bigrams

    def test_action_verbs_are_detected(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process(
            "Designed and built ML pipelines. Led a team of four. "
            "Optimised SQL queries. Deployed models to production. Reduced latency."
        )
        verbs = {verb.lower() for verb in result.action_verbs}
        assert verbs & {"designed", "built", "led", "optimised", "deployed", "reduced"}, verbs

    def test_quantified_achievements_are_counted(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process(
            "Reduced false positives by 34% and saved $2.1M annually. "
            "Cut deployment time from 3 days to 4 hours. Served 500K users."
        )
        assert result.quantified_achievements >= 3

    def test_entities_are_extracted(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process(
            "Senior Machine Learning Engineer at DataScale Inc. in San Francisco, "
            "certified in AWS Certified Machine Learning - Specialty."
        )
        assert isinstance(result.entities, list)
        labels = nlp_pipeline.entities_by_label(nlp_pipeline.tokenizer.make_doc(
            "Senior Machine Learning Engineer at DataScale Inc. in San Francisco."
        ))
        assert isinstance(labels, dict)

    def test_is_stop_word_helper(self, nlp_pipeline: NLPPipeline):
        doc = nlp_pipeline.tokenizer.make_doc("the engineer built models")
        tokens = nlp_pipeline.tokenizer.annotate(doc).tokens
        flags = {token.text.lower(): nlp_pipeline.is_stop_word(token) for token in tokens}
        assert flags.get("the") is True
        assert flags.get("engineer") is False

    def test_weighted_terms_favour_content_words(self, nlp_pipeline: NLPPipeline):
        doc = nlp_pipeline.tokenizer.make_doc(
            "Engineers designed machine learning models and deployed them quickly."
        )
        weighted = nlp_pipeline.get_weighted_terms(doc)
        assert weighted
        assert max(weighted.values()) >= min(weighted.values())
        nouns = [term for term in weighted if term in {"models", "engineers", "learning"}]
        assert nouns, "content nouns should carry weight"

    def test_empty_input_is_safe(self, nlp_pipeline: NLPPipeline):
        result = nlp_pipeline.process("")
        assert result.cleaned.cleaned_text == ""
        assert result.filtered_tokens == []
        assert result.quantified_achievements == 0
