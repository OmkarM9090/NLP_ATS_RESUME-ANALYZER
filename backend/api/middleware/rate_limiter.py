"""Rate limiting (slowapi).

The specification requires 10 analyses per minute per IP on ``POST /api/analyze``.
A light global default protects the remaining endpoints from accidental hammering
by the frontend during development.
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.middleware.request_id import client_ip
from config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _key_func(request: Request) -> str:
    """Per-IP bucket that also works behind a reverse proxy."""
    return client_ip(request)


limiter = Limiter(
    key_func=_key_func,
    default_limits=[settings.default_rate_limit] if settings.rate_limit_enabled else [],
    storage_uri=settings.rate_limit_storage_uri,
    headers_enabled=True,
)


def register_rate_limiting(app: FastAPI) -> Optional[Limiter]:
    """Wire the limiter into the app. Returns ``None`` when disabled."""
    if not settings.rate_limit_enabled:
        logger.info("rate_limiting_disabled")
        return None

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    logger.info(
        "rate_limiting_enabled",
        extra={
            "analyze_limit": settings.analyze_rate_limit,
            "default_limit": settings.default_rate_limit,
        },
    )
    return limiter


__all__ = ["limiter", "register_rate_limiting"]
