"""Aggregate API router.

All endpoints live under ``settings.api_prefix`` (``/api``):

=============================  ==============================================
``POST   /api/analyze``         Upload resume + JD, get the full analysis
``GET    /api/health``          Service / model / database health
``GET    /api/stats``           Aggregate statistics
``GET    /api/models``          Detailed NLP model registry state
``GET    /api/history``         Paginated list of past analyses
``GET    /api/history/{id}``    One stored analysis (full payload)
``DELETE /api/history/{id}``    Delete one stored analysis
``DELETE /api/history``         Clear all history
``POST   /api/history/purge``   Apply the retention window now
=============================  ==============================================
"""

from __future__ import annotations

from fastapi import APIRouter

from api.endpoints import analyze, health, history
from config import settings

api_router = APIRouter(prefix=settings.api_prefix)
api_router.include_router(analyze.router)
api_router.include_router(health.router)
api_router.include_router(history.router)

__all__ = ["api_router"]
