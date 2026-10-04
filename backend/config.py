"""Application configuration.

Centralised settings for the ATS Resume Matcher backend, loaded from
environment variables (or a local ``.env`` file) via ``pydantic-settings``.

Every tunable knob of the system lives here so that deployments can be
adjusted without touching code: model names, score weights, upload limits,
rate limits, OCR behaviour and logging.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
BACKEND_ROOT = Path(__file__).resolve().parent
DATA_DIR = BACKEND_ROOT / "data"
VAR_DIR = BACKEND_ROOT / "var"


class Settings(BaseSettings):
    """Runtime configuration for the analysis service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -- Application ------------------------------------------------------ #
    app_name: str = "ATS Resume Matcher"
    app_version: str = "1.0.0"
    environment: str = Field(default="development", description="development | staging | production")
    debug: bool = False
    api_prefix: str = "/api"

    # -- Server ----------------------------------------------------------- #
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    analysis_timeout_seconds: int = 60

    # -- CORS ------------------------------------------------------------- #
    cors_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    cors_allow_credentials: bool = True
    #: Extra origins matched by regex — covers local dev ports and sandboxed
    #: preview hosts (``https://<port>-<id>.e2b.app``) without hard-coding them.
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$|https?://.*\.e2b\.app$"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Allow ``CORS_ORIGINS="a,b"`` as well as a JSON list."""
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("["):
                return value  # let pydantic parse the JSON list
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # -- Uploads ---------------------------------------------------------- #
    max_file_size_mb: int = 10
    allowed_extensions: List[str] = Field(default_factory=lambda: [".pdf", ".txt", ".docx"])
    min_extracted_chars: int = 50

    @field_validator("allowed_extensions", mode="before")
    @classmethod
    def _split_extensions(cls, value: object) -> object:
        if isinstance(value, str):
            return [ext.strip().lower() for ext in value.split(",") if ext.strip()]
        return value

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    # -- Database --------------------------------------------------------- #
    database_url: str = f"sqlite+aiosqlite:///{(VAR_DIR / 'ats_history.db').as_posix()}"
    db_echo: bool = False
    history_page_size: int = 20
    history_max_page_size: int = 100
    history_retention_days: int = 90

    # -- NLP models ------------------------------------------------------- #
    spacy_model: str = "en_core_web_lg"
    spacy_fallback_models: List[str] = Field(
        default_factory=lambda: ["en_core_web_lg", "en_core_web_sm"]
    )
    spacy_max_length: int = 2_000_000
    sentence_transformer_model: str = "all-MiniLM-L6-v2"
    sentence_transformer_device: str = "cpu"
    semantic_chunk_size: int = 512
    enable_semantic_similarity: bool = True
    enable_eager_model_load: bool = True

    @field_validator("spacy_fallback_models", mode="before")
    @classmethod
    def _split_models(cls, value: object) -> object:
        if isinstance(value, str):
            return [m.strip() for m in value.split(",") if m.strip()]
        return value

    # -- OCR -------------------------------------------------------------- #
    enable_ocr_fallback: bool = True
    ocr_languages: str = "eng"
    ocr_dpi: int = 300
    ocr_max_pages: int = 10

    # -- Scoring weights -------------------------------------------------- #
    weight_keyword_match: float = 0.25
    weight_semantic_similarity: float = 0.30
    weight_skill_match: float = 0.25
    weight_experience_relevance: float = 0.10
    weight_education_match: float = 0.10

    # -- Extraction / matching tunables ----------------------------------- #
    tfidf_ngram_min: int = 1
    tfidf_ngram_max: int = 3
    top_keywords: int = 30
    rake_top_keywords: int = 20
    skill_fuzzy_threshold: int = 85
    skill_semantic_threshold: float = 0.72
    keyword_density_target_low: float = 0.05
    keyword_density_target_high: float = 0.60

    # Score calibration: raw cosine -> match strength via 1 - exp(-x / tau).
    # A resume/JD TF-IDF cosine of ~0.15 is already a strong match, so these
    # constants are what keep the 0-100 scores human-meaningful.
    keyword_cosine_tau: float = 0.20
    semantic_tau_transformer: float = 0.25
    semantic_tau_lsa: float = 0.15

    # -- Rate limiting ---------------------------------------------------- #
    analyze_rate_limit: str = "10/minute"
    default_rate_limit: str = "60/minute"
    rate_limit_enabled: bool = True
    #: slowapi storage URI ("memory://" is fine for a single-process deploy;
    #: use "redis://host:6379" when running several workers).
    rate_limit_storage_uri: str = "memory://"

    # -- Logging ---------------------------------------------------------- #
    log_level: str = "INFO"
    log_json: bool = False

    # -- Data files ------------------------------------------------------- #
    data_dir: Path = DATA_DIR

    @property
    def skill_taxonomy_path(self) -> Path:
        return self.data_dir / "skill_taxonomy.json"

    @property
    def industry_keywords_path(self) -> Path:
        return self.data_dir / "industry_keywords.json"

    @property
    def stop_words_path(self) -> Path:
        return self.data_dir / "stop_words_extended.json"

    @property
    def score_weights(self) -> dict[str, float]:
        """Weights keyed exactly as they appear in the API response."""
        return {
            "keyword_match": self.weight_keyword_match,
            "semantic_similarity": self.weight_semantic_similarity,
            "skill_match": self.weight_skill_match,
            "experience_relevance": self.weight_experience_relevance,
            "education_match": self.weight_education_match,
        }

    @property
    def normalized_score_weights(self) -> dict[str, float]:
        """Weights re-normalised to sum to 1.0 (guards against misconfiguration)."""
        weights = self.score_weights
        total = sum(weights.values())
        if total <= 0:
            count = len(weights) or 1
            return {key: 1.0 / count for key in weights}
        return {key: value / total for key, value in weights.items()}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings singleton."""
    return Settings()


settings = get_settings()

# Make sure the runtime directories exist early (sqlite file, logs, ...).
VAR_DIR.mkdir(parents=True, exist_ok=True)
