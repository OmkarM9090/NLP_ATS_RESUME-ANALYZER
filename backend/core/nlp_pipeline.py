"""Stages 2-7 — the complete NLP processing pipeline.

``NLPPipeline.process()`` runs, in order:

1. **Cleaning / normalisation**  (:class:`~core.text_cleaner.TextCleaner`)
2. **Tokenization**              (:class:`~core.tokenizer.Tokenizer`)
3. **Stop-word removal**         English stop words + domain boilerplate,
                                 while *protecting* meaningful technical terms
                                 (``R``, ``AI``, ``.NET`` ...)
4. **Lemmatization**             context-aware spaCy lemmatiser (or the
                                 rule-based lemmatiser offline)
5. **POS tagging**               universal tagset, exposed as a distribution and
                                 used to weight nouns/proper nouns higher
6. **NER**                       spaCy entities + taxonomy/gazetteer patterns
7. **Dependency parsing**        used for subject/object extraction and to count
                                 quantified achievements

The result is a :class:`~models.schemas.ProcessedDocument` carrying every
intermediate artefact so downstream stages never re-parse the text.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from config import settings
from core.text_cleaner import TextCleaner, text_cleaner
from core.tokenizer import Tokenizer
from models.schemas import (
    CleanedText,
    NamedEntity,
    ProcessedDocument,
    TokenInfo,
    TokenizedText,
)
from utils.logger import get_logger, log_stage
from utils.text_utils import dedupe_preserve_order

logger = get_logger(__name__)

#: POS tags that carry matching signal (skills, tools, technologies are nouns).
CONTENT_POS = {"NOUN", "PROPN", "VERB", "ADJ"}
WEIGHTED_POS = {"PROPN": 1.35, "NOUN": 1.2, "VERB": 1.0, "ADJ": 0.9, "ADV": 0.6}

QUANTIFIER_RE = re.compile(
    r"""(?:\$\s?\d[\d,\.]*\s?[kmb]?
        |\b\d+(?:\.\d+)?\s?%
        |\b\d[\d,]*\s*(?:users?|customers?|clients?|requests?|records?|rows?|transactions?
                        |employees?|engineers?|developers?|teams?|hours?|days?|weeks?|months?
                        |x\b|fold)
        |\b(?:increased|reduced|improved|grew|saved|generated|cut|boosted|raised)\s+by\s+\d+)""",
    re.IGNORECASE | re.VERBOSE,
)

ACTION_VERB_RE = re.compile(
    r"\b(led|managed|built|developed|designed|architected|implemented|automated|"
    r"optimized|scaled|deployed|migrated|refactored|launched|delivered|created|"
    r"analyzed|evaluated|mentored|coached|spearheaded|orchestrated|streamlined|"
    r"established|drove|owned|increased|reduced|improved|collaborated|presented)\b",
    re.IGNORECASE,
)


class NLPPipeline:
    """End-to-end linguistic processing for one document."""

    def __init__(
        self,
        nlp_model: Any,
        cleaner: Optional[TextCleaner] = None,
        custom_stop_words: Optional[Iterable[str]] = None,
        protected_terms: Optional[Iterable[str]] = None,
    ) -> None:
        self.nlp = nlp_model
        self.cleaner = cleaner or text_cleaner
        self.tokenizer = Tokenizer(nlp_model)
        self._custom_stop_words: Set[str] = {
            w.strip().lower() for w in (custom_stop_words or set()) if w and w.strip()
        }
        self._protected_terms: Set[str] = {
            t.strip().lower() for t in (protected_terms or set()) if t and t.strip()
        }
        # spaCy already flags stop words via ``token.is_stop``; this is the
        # language-level fallback list for pipelines built with ``spacy.blank``.
        defaults = getattr(nlp_model, "Defaults", None)
        base_stop_words = getattr(defaults, "stop_words", None) if defaults else None
        self._base_stop_words: Set[str] = set(base_stop_words or ())

    # ------------------------------------------------------------------ #
    # Main entry point
    # ------------------------------------------------------------------ #
    def process(self, raw_text: str, *, source: str = "document",
                is_ocr_text: bool = False) -> ProcessedDocument:
        """Run every pipeline stage over ``raw_text``."""
        started = time.perf_counter()
        stages: List[str] = []

        # 1. Cleaning / normalisation ------------------------------------ #
        cleaned: CleanedText = self.cleaner.clean(raw_text, is_ocr_text=is_ocr_text)
        stages.append("text_cleaning")

        # 2-6. Tokenization / stop words / lemmas / POS / deps ----------- #
        doc = self.tokenizer.make_doc(cleaned.cleaned_text)
        tokenized: TokenizedText = self.tokenizer.annotate(doc)
        stages.extend(["tokenization", "pos_tagging", "lemmatization", "dependency_parsing"])

        # 3. Stop-word removal (domain aware) ----------------------------- #
        filtered = self.get_filtered_tokens(doc)
        bigrams = self.get_bigrams(filtered)
        stages.append("stopword_removal")

        # 6. Named entity recognition ------------------------------------- #
        entities = self.extract_entities(doc)
        stages.append("ner")

        lemmas = dedupe_preserve_order(
            t.lemma for t in tokenized.tokens if t.lemma and not t.is_punct
        )
        action_verbs = dedupe_preserve_order(
            m.group(1).lower() for m in ACTION_VERB_RE.finditer(cleaned.cleaned_text)
        )
        quantified = len(QUANTIFIER_RE.findall(cleaned.cleaned_text))

        processed = ProcessedDocument(
            raw_text=raw_text,
            cleaned=cleaned,
            tokenized=tokenized,
            entities=entities,
            filtered_tokens=filtered,
            filtered_bigrams=bigrams,
            lemmas=lemmas,
            action_verbs=action_verbs,
            quantified_achievements=quantified,
            processing_time_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        log_stage(
            logger,
            "nlp_pipeline",
            source=source,
            stages=len(stages),
            tokens=len(tokenized.tokens),
            filtered=len(filtered),
            entities=len(entities),
            elapsed_ms=processed.processing_time_ms,
        )
        return processed

    # ------------------------------------------------------------------ #
    # Stage 4 — stop words
    # ------------------------------------------------------------------ #
    def is_stop_word(self, token: TokenInfo) -> bool:
        """Domain-aware stop-word test that protects meaningful short terms."""
        lowered = token.text.lower()
        if lowered in self._protected_terms:
            return False
        if token.is_stop or lowered in self._base_stop_words:
            return lowered not in self._protected_terms
        return lowered in self._custom_stop_words

    def get_filtered_tokens(self, doc: Any) -> List[str]:
        """Lemmatised, non-stop, non-punct tokens (the analysis vocabulary)."""
        out: List[str] = []
        for token in doc:
            if token.is_space or token.is_punct or token.is_digit:
                continue
            text = token.text.strip()
            lowered = text.lower()
            if not text:
                continue
            if lowered in self._protected_terms:
                out.append(lowered)
                continue
            if token.is_stop or lowered in self._base_stop_words:
                continue
            if lowered in self._custom_stop_words:
                continue
            if not self._is_content_token(token):
                continue
            lemma = (getattr(token, "lemma_", "") or lowered).strip().lower()
            out.append(lemma or lowered)
        return out

    @staticmethod
    def _is_content_token(token: Any) -> bool:
        """Keep alphabetic/technical tokens; drop stray symbols."""
        text = token.text
        if not text:
            return False
        pos = getattr(token, "pos_", "")
        if pos and pos not in CONTENT_POS and pos not in {"NUM", "X"}:
            return False
        if text.isalpha():
            return True
        # Technical tokens: C++, C#, .NET, Node.js, CI/CD
        return bool(re.fullmatch(r"[A-Za-z0-9+#./\-&]{2,}", text)) and any(c.isalpha() for c in text)

    # ------------------------------------------------------------------ #
    # Stage 5/6 — phrases
    # ------------------------------------------------------------------ #
    def get_noun_phrases(self, doc: Any) -> List[str]:
        """Extract noun chunks (multi-word technical phrases).

        Delegates to :func:`core.tokenizer.extract_noun_chunks`, which falls back
        to POS-based chunking when the loaded pipeline has no reliable parser.
        """
        from core.tokenizer import extract_noun_chunks

        return dedupe_preserve_order(extract_noun_chunks(doc))

    def get_bigrams(self, tokens: Sequence[str]) -> List[str]:
        """Bigrams over the filtered token stream (phrase-level matching)."""
        bigrams = [f"{a} {b}" for a, b in zip(tokens, tokens[1:])]
        return dedupe_preserve_order(bigrams)

    def get_pos_distribution(self, doc: Any) -> Dict[str, int]:
        """Distribution of universal POS tags across the document."""
        distribution: Dict[str, int] = {}
        for token in doc:
            if token.is_space:
                continue
            pos = token.pos_ or "X"
            distribution[pos] = distribution.get(pos, 0) + 1
        return distribution

    def get_weighted_terms(self, doc: Any) -> Dict[str, float]:
        """POS-weighted term frequencies — nouns/proper nouns count for more."""
        weights: Dict[str, float] = {}
        for token in doc:
            if token.is_space or token.is_punct:
                continue
            lowered = token.text.lower()
            if lowered in self._custom_stop_words and lowered not in self._protected_terms:
                continue
            weight = WEIGHTED_POS.get(token.pos_ or "", 0.5)
            if token.is_stop and lowered not in self._protected_terms:
                continue
            weights[lowered] = weights.get(lowered, 0.0) + weight
        return weights

    # ------------------------------------------------------------------ #
    # Stage 7 — NER
    # ------------------------------------------------------------------ #
    def extract_entities(self, doc: Any) -> List[NamedEntity]:
        """All entities from the spaCy NER model and/or the EntityRuler."""
        entities: List[NamedEntity] = []
        seen: Set[Tuple[str, str]] = set()
        try:
            spans = list(doc.ents)
        except Exception as exc:  # pragma: no cover
            logger.debug("entity_extraction_failed", extra={"error": str(exc)})
            spans = []

        for span in spans:
            text = span.text.strip()
            if not text:
                continue
            key = (text.lower(), span.label_)
            if key in seen:
                continue
            seen.add(key)
            entities.append(
                NamedEntity(
                    text=text,
                    label=span.label_,
                    start=span.start_char,
                    end=span.end_char,
                )
            )
        return entities

    def entities_by_label(self, doc: Any) -> Dict[str, List[str]]:
        """Group entity surface forms by label."""
        grouped: Dict[str, List[str]] = {}
        for entity in self.extract_entities(doc):
            grouped.setdefault(entity.label, []).append(entity.text)
        return {label: dedupe_preserve_order(values) for label, values in grouped.items()}


__all__ = ["NLPPipeline", "CONTENT_POS", "WEIGHTED_POS", "QUANTIFIER_RE"]
