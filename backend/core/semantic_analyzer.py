"""Stage 10/11 — semantic similarity.

Primary encoder: ``sentence-transformers`` (``all-MiniLM-L6-v2``) producing
dense BERT-style sentence embeddings, mean-pooled across chunks for long
documents.

Fallback encoder: **LSA** (TF-IDF + TruncatedSVD). When the transformer model
cannot be loaded — air-gapped host, blocked model hub, first boot — the
analyser fits a latent semantic space over the *sentence chunks of both
documents* and represents each document as the mean of its chunk vectors. This
is a genuine distributional-semantic method (not keyword matching), it is fully
deterministic and offline, and it keeps the semantic dimension of the score
meaningful. The active variant is reported through ``models_used`` /
``degraded_mode`` and ``GET /api/health``.
"""

from __future__ import annotations

import threading
import time
from typing import Dict, List, Optional, Sequence

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from config import settings
from utils.logger import get_logger
from utils.text_utils import chunk_text

logger = get_logger(__name__)

_TOKEN_PATTERN = r"(?u)\b[\w+#.\-/&]{2,}\b"


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors, clamped to ``[0, 1]``."""
    if a is None or b is None or a.size == 0 or b.size == 0:
        return 0.0
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    value = float(np.dot(a.ravel(), b.ravel()) / denom)
    if not np.isfinite(value):
        return 0.0
    return max(0.0, min(1.0, value))


class LSAEncoder:
    """Deterministic latent-semantic encoder (TF-IDF + TruncatedSVD)."""

    def __init__(
        self,
        n_components: int = 128,
        stop_words: Optional[Sequence[str]] = None,
        ngram_range: tuple[int, int] = (1, 2),
    ) -> None:
        self.n_components = n_components
        self.stop_words = list(stop_words) if stop_words else None
        self.ngram_range = ngram_range
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.svd: Optional[TruncatedSVD] = None
        self.explained_variance: float = 0.0

    def fit(self, corpus: Sequence[str]) -> "LSAEncoder":
        """Fit the latent space on ``corpus`` (sentence-level chunks)."""
        documents = [doc.strip() for doc in corpus if doc and doc.strip()]
        if not documents:
            return self
        components = max(8, min(self.n_components, len(documents) - 1))
        self.vectorizer = TfidfVectorizer(
            ngram_range=self.ngram_range,
            stop_words=self.stop_words if self.stop_words else "english",
            lowercase=True,
            sublinear_tf=True,
            token_pattern=_TOKEN_PATTERN,
            strip_accents="unicode",
            min_df=1,
        )
        matrix = self.vectorizer.fit_transform(documents)
        if matrix.shape[1] == 0:
            self.vectorizer = None
            return self
        components = min(components, matrix.shape[1] - 1, matrix.shape[0] - 1)
        components = max(2, components)
        self.svd = TruncatedSVD(n_components=components, random_state=42)
        self.svd.fit(matrix)
        self.explained_variance = float(self.svd.explained_variance_ratio_.sum())
        logger.debug(
            "lsa_fitted",
            extra={"docs": len(documents), "components": components,
                   "explained_variance": round(self.explained_variance, 4)},
        )
        return self

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        """Project texts into the fitted latent space (L2-normalised rows)."""
        if self.vectorizer is None or self.svd is None:
            return np.zeros((len(texts), 2), dtype=float)
        cleaned = [(t or "").strip() for t in texts]
        matrix = self.vectorizer.transform(cleaned)
        vectors = self.svd.transform(matrix)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return vectors / norms

    @property
    def is_fitted(self) -> bool:
        return self.vectorizer is not None and self.svd is not None


class SemanticAnalyzer:
    """Document-level semantic similarity with automatic encoder selection."""

    def __init__(
        self,
        registry: Optional[object] = None,
        stop_words: Optional[Sequence[str]] = None,
    ) -> None:
        from services.cache_service import model_registry

        self.registry = registry or model_registry
        self.stop_words = list(stop_words) if stop_words else None
        self._cache: Dict[str, np.ndarray] = {}
        self._cache_lock = threading.Lock()
        self._variant: Optional[str] = None

    # ------------------------------------------------------------------ #
    # Encoder plumbing
    # ------------------------------------------------------------------ #
    @property
    def encoder(self) -> Optional[object]:
        return self.registry.get_encoder() if self.registry else None

    @property
    def variant(self) -> str:
        """``"transformer"`` when a real encoder is live, else ``"lsa"``."""
        if self._variant is None:
            self._variant = "transformer" if self.encoder is not None else "lsa"
        return self._variant

    @property
    def model_name(self) -> str:
        if self.variant == "transformer":
            status = getattr(self.registry, "_encoder_status", None)
            return getattr(status, "name", settings.sentence_transformer_model)
        return "TF-IDF+LSA (offline semantic encoder)"

    # ------------------------------------------------------------------ #
    # Encoding
    # ------------------------------------------------------------------ #
    def encode_texts(self, texts: Sequence[str], *, fit_corpus: Optional[Sequence[str]] = None) -> np.ndarray:
        """Encode texts with the transformer, or with a fitted LSA space."""
        cleaned = [(t or "").strip() for t in texts]
        if not cleaned:
            return np.zeros((0, 2))

        encoder = self.encoder
        if encoder is not None:
            return self._encode_transformer(encoder, cleaned)

        corpus = list(fit_corpus or cleaned)
        chunks: List[str] = []
        spans: List[tuple[int, int]] = []
        for text in corpus:
            pieces = chunk_text(text, max_chars=settings.semantic_chunk_size, overlap=64) or [text]
            spans.append((len(chunks), len(chunks) + len(pieces)))
            chunks.extend(pieces)

        lsa = LSAEncoder(
            n_components=min(192, max(16, len(chunks) // 2)), stop_words=self.stop_words
        ).fit(chunks)
        if not lsa.is_fitted:
            return np.zeros((len(cleaned), 2))

        encoded = lsa.encode(chunks)
        # Only the first len(texts) spans correspond to the requested texts when
        # fit_corpus is supplied; map by position of the *cleaned* texts.
        if fit_corpus:
            # Re-derive chunk spans for the requested texts within the corpus.
            out: List[np.ndarray] = []
            for text in cleaned:
                pieces = chunk_text(text, max_chars=settings.semantic_chunk_size, overlap=64) or [text]
                vectors: List[np.ndarray] = []
                for piece in pieces:
                    if piece in chunks:
                        vectors.append(encoded[chunks.index(piece)])
                out.append(self._mean_pool(vectors))
            return np.vstack(out)

        vectors_by_doc = [
            self._mean_pool([encoded[start:end][i] for i in range(end - start)])
            if end > start
            else np.zeros(encoded.shape[1])
            for start, end in spans[: len(cleaned)]
        ]
        return np.vstack(vectors_by_doc)

    def _encode_transformer(self, encoder, texts: Sequence[str]) -> np.ndarray:
        """Mean-pooled transformer embeddings, chunked for long documents."""
        pieces: List[str] = []
        spans: List[tuple[int, int]] = []
        for text in texts:
            chunks = chunk_text(text, max_chars=settings.semantic_chunk_size * 2, overlap=0)
            chunks = chunks or [text]
            spans.append((len(pieces), len(pieces) + len(chunks)))
            pieces.extend(chunks)

        cache_key_hits: List[Optional[np.ndarray]] = [None] * len(pieces)
        missing: List[int] = []
        with self._cache_lock:
            for idx, piece in enumerate(pieces):
                cached = self._cache.get(piece)
                if cached is not None:
                    cache_key_hits[idx] = cached
                else:
                    missing.append(idx)

        if missing:
            started = time.perf_counter()
            raw = encoder.encode(  # type: ignore[union-attr]
                [pieces[i] for i in missing],
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
                batch_size=16,
            )
            raw = np.atleast_2d(np.asarray(raw, dtype=float))
            with self._cache_lock:
                if len(self._cache) > 4096:
                    self._cache.clear()
                for position, idx in enumerate(missing):
                    vector = raw[position]
                    self._cache[pieces[idx]] = vector
                    cache_key_hits[idx] = vector
            logger.debug(
                "transformer_encoded",
                extra={"chunks": len(missing), "elapsed_ms": round((time.perf_counter() - started) * 1000, 1)},
            )

        pooled = [self._mean_pool([v for v in cache_key_hits[start:end] if v is not None])
                  for start, end in spans]
        return np.vstack(pooled)

    @staticmethod
    def _mean_pool(vectors: Sequence[np.ndarray]) -> np.ndarray:
        usable = [np.asarray(v, dtype=float).ravel() for v in vectors if v is not None]
        if not usable:
            return np.zeros(2)
        width = max(v.size for v in usable)
        padded = np.zeros((len(usable), width))
        for idx, vector in enumerate(usable):
            padded[idx, : vector.size] = vector
        mean = padded.mean(axis=0)
        norm = float(np.linalg.norm(mean))
        return mean / norm if norm else mean

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def compute_semantic_similarity(self, text1: str, text2: str) -> float:
        """Cosine similarity between two documents (0-1)."""
        if not (text1 or "").strip() or not (text2 or "").strip():
            return 0.0
        started = time.perf_counter()
        try:
            vectors = self.encode_texts([text1, text2])
        except Exception as exc:  # noqa: BLE001 - never fail the whole analysis
            logger.warning("semantic_similarity_failed", extra={"error": str(exc)})
            return 0.0
        similarity = cosine(vectors[0], vectors[1])
        logger.debug(
            "semantic_similarity",
            extra={
                "variant": self.variant,
                "similarity": round(similarity, 4),
                "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return round(similarity, 6)

    def compute_section_similarities(
        self, resume_sections: Dict[str, str], jd_text: str
    ) -> Dict[str, float]:
        """Semantic similarity of each resume section against the full JD."""
        sections = {k: v for k, v in resume_sections.items() if v and v.strip()}
        if not sections or not (jd_text or "").strip():
            return {name: 0.0 for name in sections}

        names = list(sections.keys())
        texts = [sections[name] for name in names]
        fit_corpus = texts + [jd_text] if self.variant == "lsa" else None
        try:
            section_vectors = self.encode_texts(texts, fit_corpus=fit_corpus)
            jd_vector = self.encode_texts([jd_text], fit_corpus=fit_corpus)[0]
        except Exception as exc:  # noqa: BLE001
            logger.warning("section_similarity_failed", extra={"error": str(exc)})
            return {name: 0.0 for name in names}

        return {name: round(cosine(section_vectors[idx], jd_vector), 6) for idx, name in enumerate(names)}

    def embed(self, texts: Sequence[str]) -> np.ndarray:
        """Public embedding helper (used for semantic skill matching)."""
        try:
            return self.encode_texts(list(texts))
        except Exception as exc:  # noqa: BLE001
            logger.warning("embedding_failed", extra={"error": str(exc)})
            return np.zeros((len(texts), 2))

    def pairwise_similarity(self, left: str, right: str) -> float:
        """Similarity between two short phrases (skill/term comparison)."""
        if not left or not right:
            return 0.0
        if left.strip().lower() == right.strip().lower():
            return 1.0
        vectors = self.embed([left, right])
        return round(cosine(vectors[0], vectors[1]), 6)

    def clear_cache(self) -> None:
        with self._cache_lock:
            self._cache.clear()


#: Shared analyser instance.
semantic_analyzer = SemanticAnalyzer()

__all__ = ["SemanticAnalyzer", "LSAEncoder", "semantic_analyzer", "cosine"]
