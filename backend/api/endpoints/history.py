"""Analysis history endpoints.

``GET /api/history`` (paginated), ``GET /api/history/{id}`` (full result) and
``DELETE /api/history/{id}``. Records older than
``settings.history_retention_days`` are purged on startup and can be purged on
demand via ``POST /api/history/purge``.
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import AnalysisRepository, session_scope
from models.schemas import (
    AnalysisResponse,
    DeleteResponse,
    ErrorResponse,
    HistoryPage,
)
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["history"])


@router.get(
    "/history",
    response_model=HistoryPage,
    summary="List past analyses (paginated)",
)
async def list_history(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: Optional[int] = Query(
        None,
        ge=1,
        le=settings.history_max_page_size,
        description=f"Items per page (default {settings.history_page_size})",
    ),
    session: AsyncSession = Depends(session_scope),
) -> HistoryPage:
    """Return the newest analyses first."""
    repo = AnalysisRepository(session)
    size = page_size or settings.history_page_size
    items, total = await repo.list(page=page, page_size=size)
    return HistoryPage(
        items=items,
        total=total,
        page=page,
        page_size=size,
        pages=max(1, math.ceil(total / size)) if total else 0,
    )


@router.get(
    "/history/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Fetch one stored analysis",
    responses={404: {"model": ErrorResponse, "description": "Unknown analysis id"}},
)
async def get_history(
    analysis_id: str,
    session: AsyncSession = Depends(session_scope),
) -> AnalysisResponse:
    """Return the complete stored result for a previous analysis."""
    repo = AnalysisRepository(session)
    return await repo.get(analysis_id)


@router.delete(
    "/history/{analysis_id}",
    response_model=DeleteResponse,
    summary="Delete one stored analysis",
    responses={404: {"model": ErrorResponse, "description": "Unknown analysis id"}},
)
async def delete_history(
    analysis_id: str,
    session: AsyncSession = Depends(session_scope),
) -> DeleteResponse:
    """Remove a single analysis from history."""
    repo = AnalysisRepository(session)
    deleted = await repo.delete(analysis_id)
    return DeleteResponse(deleted=deleted, id=analysis_id, message="Analysis deleted")


@router.post(
    "/history/purge",
    response_model=DeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete analyses older than the retention window",
)
async def purge_history(
    retention_days: Optional[int] = Query(
        None, ge=0, le=3650, description="Override the configured retention window"
    ),
    session: AsyncSession = Depends(session_scope),
) -> DeleteResponse:
    """Housekeeping endpoint — returns how many rows were removed in ``message``."""
    repo = AnalysisRepository(session)
    removed = await repo.purge_old(retention_days)
    logger.info("history_purged", extra={"removed": removed, "retention_days": retention_days})
    return DeleteResponse(
        deleted=True,
        id="purge",
        message=f"{removed} analys{'is' if removed == 1 else 'es'} older than "
        f"{retention_days if retention_days is not None else settings.history_retention_days} "
        "day(s) removed",
    )


@router.delete(
    "/history",
    response_model=DeleteResponse,
    summary="Delete the entire analysis history",
)
async def clear_history(
    session: AsyncSession = Depends(session_scope),
) -> DeleteResponse:
    """Destructive convenience endpoint used by the UI's "clear history" action."""
    repo = AnalysisRepository(session)
    removed = await repo.clear_all()
    return DeleteResponse(deleted=True, id="all", message=f"{removed} analyses deleted")


__all__ = ["router"]
