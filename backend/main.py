"""FastAPI application entry point.

Run locally::

    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

or simply ``python main.py``.

Startup performs, in order:

1. configure logging from settings,
2. create/verify the SQLite schema (``var/ats_history.db``),
3. apply the history retention window,
4. warm the NLP models in a background thread so the first request is fast
   (spaCy ``en_core_web_lg`` → ``en_core_web_sm`` → offline heuristic pipeline;
   ``all-MiniLM-L6-v2`` → TF-IDF/LSA fallback),
5. install middleware (CORS, GZip, request-id, rate limiting) and routes.
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse

from api.middleware import install_middleware
from api.router import api_router
from config import settings
from core.pdf_extractor import OCRSupport
from models.database import AnalysisRepository, dispose_db, init_db, session_scope
from services.cache_service import model_registry
from utils.logger import configure_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup / shutdown."""
    configure_logging(level=settings.log_level, json_logs=settings.log_json)
    started = time.perf_counter()
    logger.info(
        "application_starting",
        extra={
            "app": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "database": settings.database_url.split("///")[-1],
        },
    )

    # 1. Database schema -------------------------------------------------- #
    try:
        await init_db()
        async for session in session_scope():
            removed = await AnalysisRepository(session).purge_old()
            if removed:
                logger.info("retention_cleanup", extra={"removed": removed})
            break
    except Exception as exc:  # noqa: BLE001 - the API can still analyse
        logger.error("database_init_failed", extra={"error": str(exc)}, exc_info=True)

    # 2. Warm NLP models -------------------------------------------------- #
    if settings.enable_eager_model_load:
        model_registry.warm_up(background=True)
    else:
        logger.info("eager_model_load_disabled")

    app.state.started_at = time.time()
    logger.info(
        "application_started",
        extra={
            "startup_ms": round((time.perf_counter() - started) * 1000, 1),
            "ocr_available": OCRSupport.is_available(),
            "docs": "/docs",
        },
    )

    try:
        yield
    finally:
        logger.info("application_shutting_down")
        await dispose_db()
        model_registry.reset()
        logger.info("application_stopped")


def create_app() -> FastAPI:
    """Application factory (used by tests and by ``uvicorn main:app``)."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "NLP-powered ATS resume matcher. Upload a resume and a job "
            "description to get a weighted match score, matched/missing skills, "
            "keyword and entity analysis, per-section scores, an ATS formatting "
            "check and prioritised recommendations."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
        contact={"name": "ATS Resume Matcher API", "url": "https://example.com/support"},
        license_info={"name": "MIT"},
    )

    install_middleware(app)
    app.include_router(api_router)

    @app.get("/", tags=["system"], summary="Service metadata")
    async def root() -> Dict[str, Any]:
        """Tiny discovery payload — the UI is served separately by Next.js."""
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "status": "ok",
            "docs": "/docs",
            "health": f"{settings.api_prefix}/health",
            "analyze": f"{settings.api_prefix}/analyze",
            "uptime_seconds": round(time.time() - getattr(app.state, "started_at", time.time()), 1),
        }

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon() -> ORJSONResponse:
        return ORJSONResponse({}, status_code=204)

    return app


app = create_app()


def main() -> None:
    """Console entry point: ``python main.py``."""
    import uvicorn

    configure_logging(level=settings.log_level, json_logs=settings.log_json)
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=settings.workers if not settings.debug else 1,
        log_config=None,  # keep uvicorn's logs inside our formatter
        timeout_graceful_shutdown=15,
    )


if __name__ == "__main__":
    main()
