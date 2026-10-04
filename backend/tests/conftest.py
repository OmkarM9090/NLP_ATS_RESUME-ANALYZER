"""Shared pytest fixtures.

Design notes
------------
* **NLP models are loaded once per session.** Building the spaCy pipeline and the
  encoder costs seconds; individual tests must stay fast.
* **The database is a throwaway SQLite file** per session, so tests never touch
  ``backend/var/ats_history.db`` and never leak rows into each other.
* **Tests pass in both model modes.** The suite runs on a machine with
  ``en_core_web_lg`` + ``all-MiniLM-L6-v2`` *and* in an air-gapped container with
  the offline heuristic pipeline + LSA encoder, so assertions are written against
  invariants (ranges, presence, ordering) rather than exact scores.
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import warnings
from pathlib import Path
from typing import Any, AsyncIterator, Dict, Iterator

import pytest

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Keep model downloads off during tests: the suite must be deterministic and
# must not hang on an unreachable Hugging Face hub.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("ATS_ALLOW_MODEL_DOWNLOAD", "0")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from config import settings  # noqa: E402  (path setup must happen first)
from core.entity_extractor import EntityExtractor  # noqa: E402
from core.keyword_extractor import KeywordExtractor
from core.nlp_pipeline import NLPPipeline  # noqa: E402
from core.pdf_extractor import PDFExtractor  # noqa: E402
from core.section_parser import SectionParser  # noqa: E402
from core.semantic_analyzer import SemanticAnalyzer  # noqa: E402
from core.text_cleaner import TextCleaner  # noqa: E402
from services.cache_service import model_registry  # noqa: E402
from tests.fixtures import (  # noqa: E402
    SAMPLE_JD_TEXT,
    SAMPLE_RESUME_TEXT,
    UNRELATED_JD_TEXT,
    UNRELATED_RESUME_TEXT,
    sample_jd_pdf,
    sample_resume_pdf,
)


# --------------------------------------------------------------------------- #
# Session fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def temp_database_url(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    """Point the ORM at a disposable SQLite file."""
    db_path = tmp_path_factory.mktemp("db") / "test_history.db"
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    previous = settings.database_url
    settings.database_url = url
    yield url
    settings.database_url = previous


@pytest.fixture(scope="session")
def nlp() -> Any:
    """The spaCy pipeline actually available in this environment."""
    model_registry.warm_up(background=False)
    return model_registry.get_nlp()


@pytest.fixture(scope="session")
def nlp_pipeline(nlp: Any) -> NLPPipeline:
    stop_words = model_registry.stop_words_data
    custom = set()
    for key in ("resume_boilerplate", "jd_boilerplate", "filler_verbs", "weak_modifiers", "noise_tokens"):
        custom.update(str(w).lower() for w in stop_words.get(key, []))
    protected = {str(t).lower() for t in stop_words.get("protected_terms", [])}
    return NLPPipeline(nlp, custom_stop_words=custom - protected, protected_terms=protected)


@pytest.fixture(scope="session")
def entity_extractor(nlp_pipeline: NLPPipeline) -> EntityExtractor:
    return EntityExtractor(nlp_pipeline)


@pytest.fixture(scope="session")
def semantic_analyzer() -> SemanticAnalyzer:
    return SemanticAnalyzer(registry=model_registry)


@pytest.fixture(scope="session")
def cleaner() -> TextCleaner:
    return TextCleaner()


@pytest.fixture(scope="session")
def section_parser_instance() -> SectionParser:
    return SectionParser()


@pytest.fixture(scope="session")
def extractor() -> PDFExtractor:
    return PDFExtractor()


@pytest.fixture(scope="session")
def cleaned_resume(cleaner: TextCleaner) -> str:
    return cleaner.clean(SAMPLE_RESUME_TEXT).cleaned_text


@pytest.fixture(scope="session")
def cleaned_jd(cleaner: TextCleaner) -> str:
    return cleaner.clean(SAMPLE_JD_TEXT).cleaned_text


@pytest.fixture(scope="session")
def resume_sections(section_parser_instance: SectionParser, cleaned_resume: str) -> Dict[str, Any]:
    return section_parser_instance.parse_sections(cleaned_resume, source="resume")


@pytest.fixture(scope="session")
def resume_doc(nlp_pipeline: NLPPipeline, cleaned_resume: str) -> Any:
    """spaCy Doc for the cleaned sample resume (as the service builds it)."""
    return nlp_pipeline.tokenizer.make_doc(cleaned_resume)


@pytest.fixture(scope="session")
def jd_doc(nlp_pipeline: NLPPipeline, cleaned_jd: str) -> Any:
    return nlp_pipeline.tokenizer.make_doc(cleaned_jd)


@pytest.fixture(scope="session")
def processed_resume(nlp_pipeline: NLPPipeline, cleaned_resume: str) -> Any:
    return nlp_pipeline.process(cleaned_resume, source="resume")


@pytest.fixture(scope="session")
def processed_jd(nlp_pipeline: NLPPipeline, cleaned_jd: str) -> Any:
    return nlp_pipeline.process(cleaned_jd, source="job_description")


@pytest.fixture(scope="session")
def resume_entities(
    entity_extractor: EntityExtractor,
    cleaner: TextCleaner,
    cleaned_resume: str,
    resume_doc,
    resume_sections,
):
    return entity_extractor.extract_resume_entities(
        cleaned_resume, resume_doc, cleaner.clean(SAMPLE_RESUME_TEXT), resume_sections
    )


@pytest.fixture(scope="session")
def jd_entities(entity_extractor: EntityExtractor, cleaned_jd: str, jd_doc):
    return entity_extractor.extract_jd_entities(cleaned_jd, jd_doc)


@pytest.fixture(scope="session")
def analysis_service(nlp: Any):
    """The full orchestrator — built once, reused by every integration test."""
    from services.analysis_service import AnalysisService

    return AnalysisService()


@pytest.fixture(scope="session")
def analysis_result(analysis_service) -> Any:
    """One complete analysis of the sample pair (the expensive fixture)."""
    return analysis_service.run_full_analysis(
        sample_resume_pdf(),
        sample_jd_pdf(),
        resume_filename="john_doe_resume.pdf",
        jd_filename="senior_ml_engineer_jd.pdf",
    )


@pytest.fixture(scope="session")
def cross_result(analysis_service) -> Any:
    """A deliberately mismatched pair — used for discrimination assertions."""
    from tests.fixtures import build_pdf

    return analysis_service.run_full_analysis(
        build_pdf(UNRELATED_RESUME_TEXT),
        sample_jd_pdf(),
        resume_filename="nurse_resume.pdf",
        jd_filename="senior_ml_engineer_jd.pdf",
    )


# --------------------------------------------------------------------------- #
# Async API client
# --------------------------------------------------------------------------- #
@pytest.fixture
async def client(temp_database_url: str) -> AsyncIterator[Any]:
    """An httpx client wired to the ASGI app with a fresh database."""
    import httpx

    from models import database
    from main import app

    await database.dispose_db()
    await database.init_db()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    await database.dispose_db()


@pytest.fixture
def sample_texts() -> Dict[str, str]:
    return {
        "resume": SAMPLE_RESUME_TEXT,
        "jd": SAMPLE_JD_TEXT,
        "unrelated_resume": UNRELATED_RESUME_TEXT,
        "unrelated_jd": UNRELATED_JD_TEXT,
    }


@pytest.fixture
def temp_dir(tmp_path: Path) -> Path:
    return tmp_path


@pytest.fixture
def temp_file(tmp_path: Path):
    def _write(name: str, data: bytes) -> Path:
        path = tmp_path / name
        path.write_bytes(data)
        return path

    return _write


__all__ = [
    "tempfile",
    "SAMPLE_RESUME_TEXT",
    "SAMPLE_JD_TEXT",
]


@pytest.fixture(scope="session")
def keyword_extractor() -> KeywordExtractor:
    """Shared TF-IDF/RAKE/TextRank extractor (stage 7b)."""
    return KeywordExtractor()
