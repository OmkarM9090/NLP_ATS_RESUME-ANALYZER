"""Model registry, caching and warm-up.

Owns every heavy NLP artefact in the process:

* the spaCy ``Language`` pipeline (``en_core_web_lg`` -> ``en_core_web_sm`` ->
  fully offline heuristic pipeline, in that order)
* the sentence-transformer encoder (``all-MiniLM-L6-v2``) used for semantic
  similarity — optional, the :class:`~core.semantic_analyzer.SemanticAnalyzer`
  falls back to a TF-IDF/LSA encoder when it is unavailable
* the compiled spaCy ``EntityRuler`` patterns derived from the skill taxonomy
  and the gazetteers

Everything is loaded once, cached, thread-safe and reported through
``GET /api/health`` so operators can see exactly which capabilities are live.
"""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from config import settings
from core.heuristic_nlp import build_offline_nlp
from models.schemas import ModelStatus
from utils.logger import get_logger

logger = get_logger(__name__)

# Fail fast instead of hanging on a blocked model hub.
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "10")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "0")

#: Aliases that are too short/ambiguous to match safely as standalone tokens.
_SHORT_ALIAS_DENYLIST = {"r", "c", "py", "tf", "dl", "cv", "ma", "ba", "ai ops"}
#: Short aliases that ARE meaningful and must be kept.
_SHORT_ALIAS_ALLOWLIST = {"ml", "nlp", "ai", "sql", "aws", "gcp", "k8s", "js", "ts", "go", "ci/cd"}


def load_json(path: Path, default: Any = None) -> Any:
    """Read a JSON data file, returning ``default`` if it is missing/invalid."""
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("data_file_unavailable", extra={"path": str(path), "error": str(exc)})
        return default if default is not None else {}


class ModelRegistry:
    """Singleton-ish registry that lazily loads and caches NLP models."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._nlp: Optional[Any] = None
        self._nlp_status = ModelStatus(name=settings.spacy_model, loaded=False, loading=False)
        self._encoder: Optional[Any] = None
        self._encoder_status = ModelStatus(
            name=settings.sentence_transformer_model, loaded=False, loading=False
        )
        self._entity_patterns: Optional[List[Dict[str, Any]]] = None
        self._taxonomy: Optional[Dict[str, Any]] = None
        self._gazetteers: Optional[Dict[str, Any]] = None
        self._industry: Optional[Dict[str, Any]] = None
        self._stopwords: Optional[Dict[str, Any]] = None
        self._warmup_started = False
        self._warmup_done = False

    # ------------------------------------------------------------------ #
    # Data files
    # ------------------------------------------------------------------ #
    @property
    def skill_taxonomy(self) -> Dict[str, Any]:
        with self._lock:
            if self._taxonomy is None:
                self._taxonomy = load_json(settings.skill_taxonomy_path, {})
            return self._taxonomy

    @property
    def gazetteers(self) -> Dict[str, Any]:
        with self._lock:
            if self._gazetteers is None:
                self._gazetteers = load_json(settings.data_dir / "gazetteers.json", {})
            return self._gazetteers

    @property
    def industry_keywords(self) -> Dict[str, Any]:
        with self._lock:
            if self._industry is None:
                self._industry = load_json(settings.industry_keywords_path, {})
            return self._industry

    @property
    def stop_words_data(self) -> Dict[str, Any]:
        with self._lock:
            if self._stopwords is None:
                self._stopwords = load_json(settings.stop_words_path, {})
            return self._stopwords

    # ------------------------------------------------------------------ #
    # EntityRuler patterns (skills + gazetteers)
    # ------------------------------------------------------------------ #
    def entity_patterns(self) -> List[Dict[str, Any]]:
        """Compile taxonomy + gazetteer entries into spaCy EntityRuler patterns."""
        with self._lock:
            if self._entity_patterns is not None:
                return self._entity_patterns

        started = time.perf_counter()
        patterns: List[Dict[str, Any]] = []
        seen: set[Tuple[str, str]] = set()

        def add(label: str, phrase: str) -> None:
            phrase = (phrase or "").strip()
            if not phrase:
                return
            lowered = phrase.lower()
            key = (label, lowered)
            if key in seen:
                return
            seen.add(key)
            if label == "SKILL" and len(lowered) <= 2:
                if lowered not in _SHORT_ALIAS_ALLOWLIST or lowered in _SHORT_ALIAS_DENYLIST:
                    return
            tokens = lowered.split()
            if label == "SKILL":
                # Keep the EntityRuler in step with the regex matcher about
                # aliases that double as ordinary English words ("next" -> Next.js).
                from core.entity_extractor import skill_surface_policy

                policy = skill_surface_policy(lowered)
                if policy == "drop":
                    return
                if policy == "exact" and len(tokens) == 1:
                    patterns.append(
                        {"label": label, "pattern": [{"ORTH": tokens[0].capitalize()}]}
                    )
                    return
            if len(tokens) == 1:
                patterns.append({"label": label, "pattern": [{"LOWER": tokens[0]}]})
            else:
                patterns.append({"label": label, "pattern": [{"LOWER": t} for t in tokens]})

        # Skills: canonical name + every alias.
        for category, entries in self.skill_taxonomy.items():
            if category.startswith("_") or not isinstance(entries, dict):
                continue
            for canonical, aliases in entries.items():
                add("SKILL", canonical)
                for alias in aliases if isinstance(aliases, list) else []:
                    add("SKILL", alias)

        # Gazetteers.
        gaz = self.gazetteers
        for name in gaz.get("organizations", []):
            add("ORG", name)
        for name in gaz.get("universities", []):
            add("ORG", name)
        for name in gaz.get("locations", []):
            add("GPE", name)
        for name in gaz.get("certifications", []):
            add("CERTIFICATION", name)
        for name in gaz.get("degrees", []):
            add("DEGREE", name)
        for name in gaz.get("job_titles", []):
            add("JOB_TITLE", name)

        self._entity_patterns = patterns
        logger.info(
            "entity_patterns_compiled",
            extra={
                "patterns": len(patterns),
                "build_time_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return patterns

    # ------------------------------------------------------------------ #
    # spaCy
    # ------------------------------------------------------------------ #
    def get_nlp(self) -> Any:
        """Return a ready spaCy pipeline, loading it on first use."""
        with self._lock:
            if self._nlp is not None:
                return self._nlp
            self._nlp = self._load_nlp_locked()
            return self._nlp

    def _load_nlp_locked(self) -> Any:
        candidates: List[str] = []
        for name in (settings.spacy_model, *settings.spacy_fallback_models):
            if name and name not in candidates:
                candidates.append(name)

        import spacy  # imported lazily: keeps cold imports off the request path

        for name in candidates:
            started = time.perf_counter()
            try:
                nlp = spacy.load(name, exclude=["textcat"])
                self._nlp_status = ModelStatus(
                    name=name,
                    loaded=True,
                    variant="statistical",
                    load_time_ms=round((time.perf_counter() - started) * 1000, 1),
                )
                logger.info(
                    "spacy_model_loaded",
                    extra={"model": name, "pipes": nlp.pipe_names,
                           "load_time_ms": self._nlp_status.load_time_ms},
                )
                return nlp
            except Exception as exc:  # noqa: BLE001 - try the next candidate
                logger.warning(
                    "spacy_model_unavailable",
                    extra={"model": name, "error": f"{type(exc).__name__}: {exc}"},
                )

        # No statistical model available -> deterministic offline pipeline.
        started = time.perf_counter()
        try:
            nlp = build_offline_nlp(self.entity_patterns(), max_length=settings.spacy_max_length)
            self._nlp_status = ModelStatus(
                name="offline-heuristic-en",
                loaded=True,
                variant="heuristic",
                error=(
                    "No statistical spaCy model installed. Using the offline heuristic "
                    "pipeline (lexicon POS tagger, rule-based lemmatiser, shallow parser, "
                    "gazetteer NER). Install en_core_web_lg for full accuracy."
                ),
                load_time_ms=round((time.perf_counter() - started) * 1000, 1),
            )
            logger.warning(
                "spacy_offline_pipeline_active",
                extra={"pipes": nlp.pipe_names, "load_time_ms": self._nlp_status.load_time_ms},
            )
            return nlp
        except Exception as exc:  # pragma: no cover - last resort
            self._nlp_status = ModelStatus(
                name="offline-heuristic-en",
                loaded=False,
                error=f"{type(exc).__name__}: {exc}",
            )
            logger.error("spacy_pipeline_build_failed", extra={"error": str(exc)}, exc_info=True)
            raise

    # ------------------------------------------------------------------ #
    # Sentence transformer (semantic encoder)
    # ------------------------------------------------------------------ #
    def get_encoder(self) -> Optional[Any]:
        """Return a SentenceTransformer, or ``None`` when unavailable."""
        with self._lock:
            if self._encoder is not None:
                return self._encoder
            if self._encoder_status.loaded is False and self._encoder_status.error:
                # Already attempted and failed — do not retry per request.
                return None
            return self._load_encoder_locked()

    def _resolve_model_path(self) -> Optional[str]:
        """Allow pointing at a locally mounted model directory."""
        candidate = settings.sentence_transformer_model
        path = Path(candidate)
        if path.exists() and (path / "config.json").exists():
            return str(path)
        return candidate

    def _model_is_local(self, name: str) -> bool:
        """True when the model is already present in a local cache/dir.

        Used to fail fast (instead of retrying for ~40s) on hosts that cannot
        reach the model hub. Set ``ATS_ALLOW_MODEL_DOWNLOAD=1`` to force a
        network attempt even when nothing is cached.
        """
        if os.environ.get("ATS_ALLOW_MODEL_DOWNLOAD", "").lower() in {"1", "true", "yes"}:
            return True
        path = Path(name)
        if path.exists() and (path / "config.json").exists():
            return True

        cache_roots = [
            Path(os.environ["HF_HOME"]) if os.environ.get("HF_HOME") else None,
            Path(os.environ["HUGGINGFACE_HUB_CACHE"]) if os.environ.get("HUGGINGFACE_HUB_CACHE") else None,
            Path(os.environ["TRANSFORMERS_CACHE"]) if os.environ.get("TRANSFORMERS_CACHE") else None,
            Path.home() / ".cache" / "huggingface",
        ]
        slug = "models--" + name.replace("/", "--")
        for root in filter(None, cache_roots):
            for sub in (root, root / "hub"):
                candidate = Path(sub) / slug
                if candidate.exists():
                    return True
        return False

    def _load_encoder_locked(self) -> Optional[Any]:
        if not settings.enable_semantic_similarity:
            self._encoder_status = ModelStatus(
                name=settings.sentence_transformer_model,
                loaded=False,
                error="Semantic encoder disabled via ENABLE_SEMANTIC_SIMILARITY=false",
            )
            return None

        started = time.perf_counter()
        model_name = settings.sentence_transformer_model
        if not self._model_is_local(model_name):
            # No local copy -> forbid network round-trips so the failure is
            # immediate instead of a long retry storm.
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

        try:
            from sentence_transformers import SentenceTransformer

            target = self._resolve_model_path()
            encoder = SentenceTransformer(target, device=settings.sentence_transformer_device)
            # Smoke test: guarantees the model actually produces embeddings.
            probe = encoder.encode(["semantic encoder smoke test"], convert_to_numpy=True)
            self._encoder = encoder
            self._encoder_status = ModelStatus(
                name=settings.sentence_transformer_model,
                loaded=True,
                variant="transformer",
                load_time_ms=round((time.perf_counter() - started) * 1000, 1),
            )
            logger.info(
                "semantic_encoder_loaded",
                extra={
                    "model": target,
                    "dim": int(probe.shape[-1]),
                    "load_time_ms": self._encoder_status.load_time_ms,
                },
            )
            return encoder
        except Exception as exc:  # noqa: BLE001
            self._encoder_status = ModelStatus(
                name=settings.sentence_transformer_model,
                loaded=False,
                variant="lsa_fallback",
                error=(
                    f"{type(exc).__name__}: {exc}. Falling back to the deterministic "
                    "TF-IDF/LSA semantic encoder."
                ),
                load_time_ms=round((time.perf_counter() - started) * 1000, 1),
            )
            logger.warning(
                "semantic_encoder_unavailable",
                extra={"model": settings.sentence_transformer_model, "error": str(exc)[:400]},
            )
            return None

    # ------------------------------------------------------------------ #
    # Warm-up / status
    # ------------------------------------------------------------------ #
    def warm_up(self, background: bool = True) -> None:
        """Preload models so the first request is not penalised."""
        with self._lock:
            if self._warmup_started:
                return
            self._warmup_started = True

        def _run() -> None:
            started = time.perf_counter()
            try:
                self.get_nlp()
            except Exception as exc:  # pragma: no cover
                logger.error("warmup_nlp_failed", extra={"error": str(exc)}, exc_info=True)
            try:
                self.get_encoder()
            except Exception as exc:  # pragma: no cover
                logger.error("warmup_encoder_failed", extra={"error": str(exc)}, exc_info=True)
            self._warmup_done = True
            logger.info(
                "models_warm",
                extra={
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                    "spacy": self._nlp_status.name,
                    "encoder_loaded": self._encoder_status.loaded,
                },
            )

        if background:
            threading.Thread(target=_run, name="model-warmup", daemon=True).start()
        else:
            _run()

    @property
    def is_warm(self) -> bool:
        return self._warmup_done

    def status(self) -> Dict[str, ModelStatus]:
        """Snapshot of model availability for the health endpoint."""
        return {
            "spacy": self._nlp_status.model_copy(),
            "sentence_transformer": self._encoder_status.model_copy(),
        }

    def models_used(self) -> List[str]:
        """Human-readable list of models that actually contributed."""
        used: List[str] = []
        if self._nlp_status.loaded:
            used.append(
                f"{self._nlp_status.name}"
                + ("" if self._nlp_status.variant == "statistical" else " (heuristic offline pipeline)")
            )
        used.append(
            self._encoder_status.name
            if self._encoder_status.loaded
            else "TF-IDF+LSA semantic encoder"
        )
        used.append("TF-IDF (scikit-learn)")
        used.append("RAKE keyword extraction")
        used.append("Skill taxonomy matcher (rapidfuzz)")
        return used

    @property
    def degraded(self) -> bool:
        """True when any capability is running on a fallback."""
        return (not self._encoder_status.loaded) or (
            self._nlp_status.variant != "statistical" and self._nlp_status.loaded
        )

    def reset(self) -> None:
        """Drop cached models (used by tests)."""
        with self._lock:
            self._nlp = None
            self._encoder = None
            self._entity_patterns = None
            self._warmup_started = False
            self._warmup_done = False


#: Process-wide registry instance.
model_registry = ModelRegistry()


def get_model_registry() -> ModelRegistry:
    """FastAPI dependency returning the shared registry."""
    return model_registry


__all__ = ["ModelRegistry", "model_registry", "get_model_registry", "load_json"]
