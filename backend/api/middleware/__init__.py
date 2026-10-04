"""API middleware package.

``install_middleware(app)`` is the single call :mod:`main` needs: it layers
CORS, GZip, request-id correlation and rate limiting in the correct order.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from api.middleware.error_handler import register_exception_handlers
from api.middleware.rate_limiter import limiter, register_rate_limiting
from api.middleware.request_id import HEADER_NAME, RequestIDMiddleware, client_ip
from config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def install_middleware(app: FastAPI) -> None:
    """Register CORS, compression, correlation ids, rate limits and handlers.

    Starlette applies middleware in reverse registration order, so the request
    id is registered last to sit closest to the route handlers and be visible
    to every other layer's log lines.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[HEADER_NAME, "X-Process-Time-Ms", "X-RateLimit-Limit",
                        "X-RateLimit-Remaining", "Retry-After"],
        max_age=600,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(RequestIDMiddleware)

    register_rate_limiting(app)
    register_exception_handlers(app)

    logger.info(
        "middleware_installed",
        extra={"cors_origins": settings.cors_origins, "rate_limit": settings.rate_limit_enabled},
    )


__all__ = [
    "install_middleware",
    "register_exception_handlers",
    "register_rate_limiting",
    "limiter",
    "RequestIDMiddleware",
    "client_ip",
    "HEADER_NAME",
]
