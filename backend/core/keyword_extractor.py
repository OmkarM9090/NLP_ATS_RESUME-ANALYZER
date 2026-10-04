"""Stage 8 — keyword extraction (TF-IDF + RAKE + TextRank).

Three complementary extractors are merged into a single ranked list:

* **TF-IDF** (scikit-learn, 1-3 grams) — terms that are frequent here and
  distinctive against the compared document. This is also what produces the
  keyword-level cosine similarity score.
* **RAKE** — rapid automatic keyword extraction using stop-word delimited
  candidate phrases scored by ``degree(w)/frequency(w)``. Implemented natively
  so it has **no NLTK corpus dependency** (``rake-nltk`` is used as a
  cross-check when its data is available).
* **TextRank** — PageRank over a word co-occurrence graph, which surfaces
  central technical phrases that TF-IDF can under-rank in short documents.
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from config import settings
from models.schemas import JDKeyword, KeywordDensity, KeywordScore
from utils.logger import get_logger
from utils.text_utils import collapse_whitespace, dedupe_preserve_order

logger = get_logger(__name__)

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;:\n])\s+|(?<=\n)")
PHRASE_DELIMITER_RE = re.compile(
    r"(?:[^a-z0-9+#.\-/&\s]|\b(?:"
    r"the|a|an|and|or|but|of|to|in|for|on|with|at|by|from|as|is|are|was|were|be|been|being|"
    r"this|that|these|those|it|its|we|our|you|your|they|their|he|she|his|her|will|would|"
    r"can|could|should|may|might|must|have|has|had|do|does|did|not|no|all|any|each|"
    r"into|about|over|under|between|through|during|before|after|than|then|also|such|"
    r"including|include|includes|using|use|used|work|working|works|role|position|team"
    r")\b)",
    re.IGNORECASE,
)
WORD_RE = re.compile(r"[a-z0-9+#.\-/&]+", re.IGNORECASE)
_MIN_PHRASE_CHARS = 2
_MAX_PHRASE_CHARS = 40


class KeywordExtractor:
    """TF-IDF / RAKE / TextRank keyword extraction and comparison."""

    def __init__(
        self,
        stop_words: Optional[Iterable[str]] = None,
        ngram_range: Optional[Tuple[int, int]] = None,
        protected_terms: Optional[Iterable[str]] = None,
    ) -> None:
        self.ngram_range = ngram_range or (settings.tfidf_ngram_min, settings.tfidf_ngram_max)
        self.stop_words = self._build_stop_words(stop_words, protected_terms)

    @staticmethod
    def _build_stop_words(
        custom: Optional[Iterable[str]], protected: Optional[Iterable[str]] = None
    ) -> Optional[List[str]]:
        """Union sklearn's English list with domain stop words.

        Technical terms that happen to look like stop words (``R``, ``.NET``,
        ``AI``) are removed from the list so they survive vectorisation.
        """
        if custom is None:
            return None
        try:
            from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

            base = set(ENGLISH_STOP_WORDS)
        except ImportError:  # pragma: no cover
            base = set()
        merged = base | {str(w).strip().lower() for w in custom if w and str(w).strip()}
        merged -= {str(p).strip().lower() for p in (protected or ()) if p and str(p).strip()}
        return sorted(merged)

    #: Numeric/salary fragments and other tokens that are never useful keywords.
    _NUMERIC_NOISE_RE = re.compile(r"^[\d\s.,:;/\-%$€£+()]+$")

    @classmethod
    def is_valid_keyword(cls, term: str) -> bool:
        """Reject tokens that cannot be meaningful resume keywords.

        Filters currency/salary fragments ("000" from "$180,000"), bare years,
        single letters and absurdly long n-grams.
        """
        if not term or not term.strip():
            return False
        cleaned = term.strip()
        if len(cleaned) > 48:
            return False
        if cls._NUMERIC_NOISE_RE.match(cleaned):
            return False
        if not re.search(r"[A-Za-z]", cleaned):
            return False
        # "000", "180k", "2024" style fragments.
        if re.fullmatch(r"[A-Za-z]?\d+[a-z]?", cleaned):
            return False
        words = cleaned.split()
        if len(words) > 5:
            return False
        return True

    # ------------------------------------------------------------------ #
    # TF-IDF
    # ------------------------------------------------------------------ #
    def extract_tfidf_keywords(self, text: str, top_n: int = 30) -> List[KeywordScore]:
        """Top-N TF-IDF terms/phrases for a single document."""
        if not text or not text.strip():
            return []
        try:
            vectorizer = TfidfVectorizer(
                ngram_range=self.ngram_range,
                stop_words=self.stop_words if self.stop_words else "english",
                lowercase=True,
                min_df=1,
                max_features=20000,
                sublinear_tf=True,
                token_pattern=r"(?u)\b[\w+#.\-/&]{2,}\b",
                strip_accents="unicode",
            )
            matrix = vectorizer.fit_transform([text])
        except ValueError as exc:
            logger.debug("tfidf_extraction_failed", extra={"error": str(exc)})
            return []

        vocab = vectorizer.vocabulary_
        row = matrix.toarray()[0]
        scored = [
            KeywordScore(
                keyword=term,
                score=round(float(row[idx]), 6),
                method="tfidf",
                count=len(re.findall(re.escape(term), text, flags=re.IGNORECASE)),
            )
            for term, idx in vocab.items()
            if row[idx] > 0 and self.is_valid_keyword(term)
        ]
        scored.sort(key=lambda k: k.score, reverse=True)
        return scored[:top_n]

    def tfidf_cosine_similarity(self, text_a: str, text_b: str) -> Tuple[float, Dict[str, float]]:
        """Cosine similarity between two documents in TF-IDF space.

        Returns ``(similarity, per_term_idf)`` — the IDF map is reused to rank
        job-description keywords by how distinctive they are.
        """
        if not text_a.strip() or not text_b.strip():
            return 0.0, {}
        try:
            vectorizer = TfidfVectorizer(
                ngram_range=self.ngram_range,
                stop_words=self.stop_words if self.stop_words else "english",
                lowercase=True,
                sublinear_tf=True,
                token_pattern=r"(?u)\b[\w+#.\-/&]{2,}\b",
                strip_accents="unicode",
            )
            matrix = vectorizer.fit_transform([text_a, text_b])
        except ValueError as exc:
            logger.debug("tfidf_similarity_failed", extra={"error": str(exc)})
            return 0.0, {}

        a = matrix[0].toarray()[0]
        b = matrix[1].toarray()[0]
        denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
        similarity = float(np.dot(a, b) / denominator) if denominator else 0.0
        idf_map = dict(zip(vectorizer.get_feature_names_out(), vectorizer.idf_))
        return round(max(0.0, min(1.0, similarity)), 6), idf_map

    # ------------------------------------------------------------------ #
    # RAKE
    # ------------------------------------------------------------------ #
    def extract_rake_keywords(self, text: str, top_n: int = 20) -> List[KeywordScore]:
        """Native RAKE implementation (stop-word delimited candidate phrases)."""
        candidates = self._rake_candidates(text)
        if not candidates:
            return []

        frequency: Counter = Counter()
        degree: Counter = Counter()
        for phrase_words in candidates:
            phrase_degree = len(phrase_words) - 1
            for word in phrase_words:
                frequency[word] += 1
                degree[word] += phrase_degree

        word_score = {
            word: (degree[word] + frequency[word]) / frequency[word] for word in frequency
        }
        phrase_scores: Dict[str, float] = {}
        phrase_counts: Counter = Counter()
        for phrase_words in candidates:
            phrase = " ".join(phrase_words)
            phrase_counts[phrase] += 1
            phrase_scores[phrase] = phrase_scores.get(phrase, 0.0) + sum(
                word_score[w] for w in phrase_words
            )

        ranked = sorted(phrase_scores.items(), key=lambda item: item[1], reverse=True)
        return [
            KeywordScore(
                keyword=phrase,
                score=round(score, 4),
                method="rake",
                count=phrase_counts[phrase],
            )
            for phrase, score in ranked[:top_n]
            if _MIN_PHRASE_CHARS <= len(phrase) <= _MAX_PHRASE_CHARS
        ]

    def _rake_candidates(self, text: str) -> List[List[str]]:
        lowered = text.lower()
        sentences = [s for s in SENTENCE_SPLIT_RE.split(lowered) if s and s.strip()]
        candidates: List[List[str]] = []
        for sentence in sentences:
            for chunk in PHRASE_DELIMITER_RE.split(sentence):
                if not chunk:
                    continue
                words = [w for w in WORD_RE.findall(chunk) if len(w) > 1]
                if words:
                    candidates.append(words)
        return candidates

    # ------------------------------------------------------------------ #
    # TextRank
    # ------------------------------------------------------------------ #
    def extract_textrank_keywords(
        self, text: str, top_n: int = 15, window: int = 3, damping: float = 0.85,
        stopwords: Optional[Iterable[str]] = None,
    ) -> List[KeywordScore]:
        """TextRank (PageRank over a word co-occurrence graph)."""
        stop_set = set(w.lower() for w in (stopwords or []))
        words = [
            w.lower()
            for w in WORD_RE.findall(text)
            if len(w) > 1
            and any(c.isalpha() for c in w)
            and w.lower() not in stop_set
            and not w.isdigit()
        ]
        if len(words) < 4:
            return []

        unique = sorted(set(words))
        index = {word: i for i, word in enumerate(unique)}
        size = len(unique)
        matrix = np.zeros((size, size), dtype=float)

        for start, word in enumerate(words):
            for neighbour in words[start + 1: start + window + 1]:
                if neighbour == word:
                    continue
                matrix[index[word], index[neighbour]] += 1.0
                matrix[index[neighbour], index[word]] += 1.0

        # Row-normalise so each node distributes its rank evenly to neighbours.
        out_degree = matrix.sum(axis=1)
        transition = np.divide(
            matrix, out_degree[:, None], out=np.zeros_like(matrix), where=out_degree[:, None] > 0
        )
        scores = np.full(size, 1.0 / size, dtype=float)
        for _ in range(50):  # power iteration converges quickly on small graphs
            new_scores = (1 - damping) / size + damping * transition.T.dot(scores)
            if np.abs(new_scores - scores).sum() < 1e-7:
                scores = new_scores
                break
            scores = new_scores

        counts = Counter(words)
        ranked = sorted(
            ((unique[i], float(scores[i])) for i in range(size)), key=lambda x: x[1], reverse=True
        )
        maximum = ranked[0][1] if ranked and ranked[0][1] else 1.0
        return [
            KeywordScore(
                keyword=word,
                score=round(score / maximum, 6),
                method="textrank",
                count=counts[word],
            )
            for word, score in ranked[:top_n]
        ]

    # ------------------------------------------------------------------ #
    # Combined
    # ------------------------------------------------------------------ #
    def get_combined_keywords(
        self,
        text: str,
        top_n: int = 30,
        stopwords: Optional[Iterable[str]] = None,
    ) -> List[KeywordScore]:
        """Merge TF-IDF, RAKE and TextRank results, deduplicate and re-rank."""
        tfidf = self.extract_tfidf_keywords(text, top_n=max(top_n, 30))
        rake = self.extract_rake_keywords(text, top_n=settings.rake_top_keywords)
        textrank = self.extract_textrank_keywords(text, top_n=20, stopwords=stopwords)

        merged: Dict[str, KeywordScore] = {}

        def normalise(score: float, values: Sequence[float]) -> float:
            if not values:
                return 0.0
            maximum = max(values)
            return score / maximum if maximum else 0.0

        for group, weight in ((tfidf, 0.5), (rake, 0.3), (textrank, 0.2)):
            raw = [item.score for item in group]
            for item in group:
                key = item.keyword.strip().lower()
                if not key or not self.is_valid_keyword(key):
                    continue  # numeric/salary fragments, over-long n-grams, ...
                contribution = normalise(item.score, raw) * weight
                existing = merged.get(key)
                if existing is None:
                    merged[key] = KeywordScore(
                        keyword=item.keyword.strip(),
                        score=round(contribution, 6),
                        method=item.method,
                        count=item.count,
                    )
                else:
                    existing.score = round(existing.score + contribution, 6)
                    existing.count = max(existing.count, item.count)
                    if item.method not in existing.method:
                        existing.method = f"{existing.method}+{item.method}"

        ranked = sorted(merged.values(), key=lambda item: item.score, reverse=True)
        return ranked[:top_n]

    # ------------------------------------------------------------------ #
    # Comparative analysis (resume vs job description)
    # ------------------------------------------------------------------ #
    def compare(
        self,
        resume_text: str,
        jd_text: str,
        top_n: int = 30,
        stopwords: Optional[Iterable[str]] = None,
    ) -> Tuple[float, List[JDKeyword], List[JDKeyword], List[str]]:
        """Keyword-level comparison of resume and job description.

        Returns ``(tfidf_cosine, top_jd_keywords, top_resume_keywords, common)``.
        """
        similarity, idf_map = self.tfidf_cosine_similarity(resume_text, jd_text)

        jd_keywords = self.get_combined_keywords(jd_text, top_n=top_n, stopwords=stopwords)
        resume_keywords = self.get_combined_keywords(
            resume_text, top_n=top_n, stopwords=stopwords
        )

        resume_lower = resume_text.lower()
        resume_lemma_set = {item.keyword.lower() for item in resume_keywords}

        top_jd: List[JDKeyword] = []
        for item in jd_keywords:
            key = item.keyword.lower()
            occurrences = len(re.findall(re.escape(key), resume_lower))
            found = occurrences > 0 or key in resume_lemma_set or self._stem_present(
                key, resume_lower
            )
            idf = float(idf_map.get(key, 1.0))
            top_jd.append(
                JDKeyword(
                    keyword=item.keyword,
                    tfidf_score=item.score,
                    found_in_resume=found,
                    occurrences=item.count,
                    importance=round(item.score * (1.0 + math.log1p(max(idf, 0.0))) / 3.0, 6),
                )
            )

        jd_lower = jd_text.lower()
        jd_key_set = {item.keyword.lower() for item in jd_keywords}
        top_resume = [
            JDKeyword(
                keyword=item.keyword,
                tfidf_score=item.score,
                found_in_resume=item.keyword.lower() in jd_key_set
                or item.keyword.lower() in jd_lower,
                occurrences=item.count,
                importance=item.score,
            )
            for item in resume_keywords
        ]

        resume_norm = collapse_whitespace(resume_text.lower())
        jd_norm = collapse_whitespace(jd_text.lower())
        # Drop n-grams the vectorizer stitched across a line/sentence boundary —
        # they only exist if they appear contiguously in the source text.
        top_jd = [k for k in top_jd if " " not in k.keyword or k.keyword.lower() in jd_norm]
        top_resume = [
            k for k in top_resume if " " not in k.keyword or k.keyword.lower() in resume_norm
        ]

        top_jd = self._drop_redundant_ngrams(top_jd)
        top_resume = self._drop_redundant_ngrams(top_resume)

        common = dedupe_preserve_order(
            [item.keyword for item in top_jd if item.found_in_resume]
        )
        return similarity, top_jd, top_resume, common

    @staticmethod
    def _drop_redundant_ngrams(keywords: Sequence[JDKeyword]) -> List[JDKeyword]:
        """Remove phrases subsumed by a stronger phrase and bare sub-words.

        * "machine" / "learning" disappear once "machine learning" is kept.
        * "senior machine" disappears when "senior machine learning" scores
          higher (prefix/suffix only, so mid-phrases like "machine learning"
          survive).
        """
        ordered = sorted(keywords, key=lambda k: k.tfidf_score, reverse=True)
        multi_tokens = [k.keyword.lower().split() for k in ordered if " " in k.keyword]
        kept: List[JDKeyword] = []
        for item in ordered:
            tokens = item.keyword.lower().split()
            if len(tokens) == 1 and any(set(tokens) < set(phrase) for phrase in multi_tokens):
                continue
            if len(tokens) > 1:
                redundant = False
                for phrase in multi_tokens:
                    if len(phrase) <= len(tokens):
                        continue
                    prefix = phrase[: len(tokens)] == tokens
                    suffix = phrase[-len(tokens):] == tokens
                    if prefix or suffix:
                        longer = next(
                            (k for k in ordered if k.keyword.lower().split() == phrase), None
                        )
                        if longer is not None and longer.tfidf_score >= item.tfidf_score:
                            redundant = True
                            break
                if redundant:
                    continue
            kept.append(item)
        # Restore the original (score-descending) order after filtering.
        return sorted(kept, key=lambda k: k.tfidf_score, reverse=True)

    @staticmethod
    def _stem_present(keyword: str, haystack: str) -> bool:
        """Cheap stemming check so 'pipeline' matches 'pipelines'."""
        stems = {keyword}
        for suffix in ("s", "es", "ing", "ed", "er", "ion", "ment"):
            if keyword.endswith(suffix) and len(keyword) - len(suffix) >= 4:
                stems.add(keyword[: -len(suffix)])
        return any(re.search(rf"\b{re.escape(stem)}", haystack) for stem in stems)

    # ------------------------------------------------------------------ #
    def keyword_density(
        self, text: str, keywords: Sequence[JDKeyword]
    ) -> KeywordDensity:
        """Fraction of document tokens covered by the top keywords.

        Coverage is computed on *token positions* rather than summed occurrence
        counts, so overlapping n-grams ("machine learning" and "machine") cannot
        inflate the ratio past 100%.
        """
        words = WORD_RE.findall(text.lower())
        total = len(words)
        if not total:
            return KeywordDensity(resume=0.0, jd=0.0, resume_status="under_optimized",
                                  jd_status="under_optimized")

        covered = [False] * total
        phrases = sorted(
            {tuple(w.lower() for w in WORD_RE.findall(k.keyword)) for k in keywords if k.keyword},
            key=len,
            reverse=True,
        )
        for phrase in phrases:
            length = len(phrase)
            if not length:
                continue
            target = list(phrase)
            for start in range(total - length + 1):
                if covered[start]:
                    continue
                if words[start: start + length] == target:
                    for offset in range(length):
                        covered[start + offset] = True

        density = round(min(1.0, sum(covered) / total), 4)
        status = self._density_status(density)
        return KeywordDensity(resume=density, jd=density, resume_status=status, jd_status=status)

    @staticmethod
    def _density_status(density: float) -> str:
        if density < settings.keyword_density_target_low:
            return "under_optimized"
        if density > settings.keyword_density_target_high:
            return "over_optimized"
        return "optimal"


#: Shared extractor instance.
keyword_extractor = KeywordExtractor()

__all__ = ["KeywordExtractor", "keyword_extractor"]
