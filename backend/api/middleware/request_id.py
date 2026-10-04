"""Request-id / correlation middleware.

Assigns every inbound request a short id, publishes it on the logging context
(so all log lines for that request can be correlated) and echoes it back to the
client in the ``X-Request-ID`` response header — the same value the frontend
shows in its error toasts.
"""

from __future__ import annotations

import time
import uuid
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from utils.logger import get_logger, reset_request_id, set_request_id

logger = get_logger("api.request")

HEADER_NAME = "X-Request-ID"
#: Public paths that would otherwise flood the access log.
_QUIET_PATHS = {"/api/health", "/health", "/favicon.ico"}


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a correlation id + timing to every request."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get(HEADER_NAME)
        request_id = _normalise_id(incoming) or uuid.uuid4().hex[:16]
        token = set_request_id(request_id)
        request.state.request_id = request_id

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "request_failed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration_ms, 1),
                },
            )
            raise
        finally:
            reset_request_id(token)

        duration_ms = (time.perf_counter() - started) * 1000
        response.headers[HEADER_NAME] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.1f}"
        request.state.duration_ms = duration_ms

        if request.url.path not in _QUIET_PATHS:
            logger.info(
                "request_completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round(duration_ms, 1),
                    "client": _client_ip(request),
                },
            )
        return response


def _normalise_id(value: str | None) -> str | None:
    """Accept only sane, log-safe correlation ids from clients."""
    if not value:
        return None
    cleaned = "".join(ch for ch in value.strip() if ch.isalnum() or ch in "-_")
    return cleaned[:64] or None


def client_ip(request: Request) -> str:
    """Best-effort client IP, honouring a reverse proxy's X-Forwarded-For."""
    return _client_ip(request)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


__all__ = ["RequestIDMiddleware", "HEADER_NAME", "client_ip"]
