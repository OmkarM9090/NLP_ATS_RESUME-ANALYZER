"""Health, readiness and statistics endpoints.

``GET /api/health`` is the observability surface: it reports per-model load
state (including which fallback variant is active), OCR availability, database
reachability and uptime. The frontend polls it to decide whether to show the
"reduced-accuracy mode" banner.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core.pdf_extractor import OCRSupport
from models.database import AnalysisRepository, session_scope
from models.schemas import ErrorResponse, HealthResponse, StatsResponse
from services.cache_service import model_registry
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["system"])

_started_at = time.time()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service and model health",
    responses={503: {"model": ErrorResponse, "description": "Models unavailable"}},
)
async def health(session: AsyncSession = Depends(session_scope)) -> HealthResponse:
    """Report service health, NLP model status and database reachability."""
    database_ok = True
    analyses_count = 0
    try:
        repo = AnalysisRepository(session)
        analyses_count = await repo.count()
    except Exception as exc:  # noqa: BLE001 - health must never 500 on DB blips
        database_ok = False
        logger.warning("health_db_check_failed", extra={"error": str(exc)})

    models = model_registry.status()
    spacy_status = models.get("spacy")
    nlp_ready = bool(spacy_status and spacy_status.loaded)
    return HealthResponse(
        status=_health_status(nlp_ready=nlp_ready, database_ok=database_ok),
        version=settings.app_version,
        environment=settings.environment,
        uptime_seconds=round(time.time() - _started_at, 1),
        models=models,
        ocr_available=OCRSupport.is_available(),
        database_ok=database_ok,
        analyses_count=analyses_count,
    )


def _health_status(*, nlp_ready: bool, database_ok: bool) -> str:
    """Derive the service status from real capability, not just "did it import".

    - ``unhealthy``: the NLP pipeline cannot run at all, so every analysis fails.
    - ``degraded``: analysis works, but on a fallback model (offline heuristic
      spaCy, TF-IDF/LSA encoder) or with history storage unavailable. The
      registry's own ``degraded`` flag is the source of truth here, so the API
      never claims full capability while serving reduced-accuracy scores.
    - ``ok``: full model stack and a reachable database.
    """
    if not nlp_ready:
        return "unhealthy"
    if model_registry.degraded or not database_ok:
        return "degraded"
    return "ok"


@router.get(
    "/stats",
    response_model=StatsResponse,
    summary="Aggregate analysis statistics",
)
async def stats(
    session: AsyncSession = Depends(session_scope),
    limit: int = Query(8, ge=1, le=25, description="Most common missing skills to return"),
) -> StatsResponse:
    """Aggregate numbers used by the dashboard/landing stats section."""
    repo = AnalysisRepository(session)
    raw: Dict[str, Any] = await repo.stats()
    missing_skills = await repo.most_common_missing_skills(limit=limit)
    return StatsResponse(
        total_analyses=int(raw.get("total_analyses", 0)),
        average_score=round(float(raw.get("average_score", 0.0) or 0.0), 1),
        best_score=round(float(raw.get("best_score", 0.0) or 0.0), 1),
        worst_score=round(float(raw.get("worst_score", 0.0) or 0.0), 1),
        score_distribution=raw.get("score_distribution", {}) or {},
        most_common_missing_skills=missing_skills,
    )


@router.get("/models", summary="Detailed NLP model registry state")
async def models_detail() -> Dict[str, Any]:
    """Full registry view (variants, load times, degradation flags)."""
    return {
        "models": {name: status.model_dump() for name, status in model_registry.status().items()},
        "models_used": model_registry.models_used(),
        "degraded_mode": model_registry.degraded,
        "is_warm": bool(model_registry.is_warm),
        "ocr_available": OCRSupport.is_available(),
        "score_weights": settings.score_weights,
    }


__all__ = ["router"]
