"""Global exception → HTTP translation.

Maps the typed :mod:`utils.exceptions` hierarchy (and framework errors) onto the
: class:`~models.schemas.ErrorResponse` envelope so the frontend always receives
``{error, detail, code, request_id, timestamp}`` — never a raw traceback.

Status-code contract required by the specification:

========================== ===== ============================================
Error                      HTTP  Notes
========================== ===== ============================================
FileValidationError        422   bad extension / size / empty / corrupted
UnsupportedFileTypeError   415   subclass of FileValidationError
FileTooLargeError          413   subclass of FileValidationError
PDFExtractionError         422   no readable text (incl. failed OCR)
InsufficientTextError      422   text below ``min_extracted_chars``
AnalysisTimeoutError       408   analysis exceeded the time budget
RateLimitExceeded          429   10/min per IP on ``POST /api/analyze``
NotFoundError              404   unknown history id
ModelLoadError             503   models unavailable
NLPProcessingError         500   pipeline failure
========================== ===== ============================================
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from utils.exceptions import ATSError
from utils.logger import get_logger, get_request_id

logger = get_logger(__name__)

#: Framework/library exceptions that mean "the client sent something unusable".
_CLIENT_ERROR_NAMES = {"MultiPartException", "FormDataError", "BadRequest"}


def _envelope(
    error: str,
    *,
    code: Optional[str] = None,
    detail: Optional[Any] = None,
    request: Optional[Request] = None,
    status_code: int = 500,
    headers: Optional[dict] = None,
) -> JSONResponse:
    """Build the standard error response."""
    from datetime import datetime, timezone

    payload: dict[str, Any] = {
        "error": error,
        "detail": detail,
        "code": code or "internal_error",
        "request_id": (request.state.request_id if request and hasattr(request.state, "request_id")
                       else get_request_id()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=status_code, content=payload, headers=headers or {})


def register_exception_handlers(app: FastAPI) -> None:
    """Attach every handler to the application."""

    @app.exception_handler(ATSError)
    async def ats_error_handler(request: Request, exc: ATSError) -> JSONResponse:
        status_code = exc.status_code
        detail = exc.detail if settings.debug or status_code < 500 else None
        log = logger.warning if status_code < 500 else logger.error
        log(
            "ats_error",
            extra={
                "code": exc.code,
                "status": status_code,
                "error_message": exc.message,
                "path": request.url.path,
                "context": exc.context or None,
            },
        )
        headers: dict[str, str] = {}
        if status_code == 429:
            headers["Retry-After"] = str(exc.context.get("retry_after", 60))
        return _envelope(
            exc.message,
            code=exc.code,
            detail=detail,
            request=request,
            status_code=status_code,
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        # Pydantic v2 can embed non-serialisable objects (e.g. bytes) in `ctx`.
        safe = []
        for err in errors:
            safe.append(
                {
                    "field": ".".join(str(p) for p in err.get("loc", [])) or "body",
                    "message": err.get("msg", "Invalid value"),
                    "type": err.get("type", "value_error"),
                }
            )
        first = safe[0]["message"] if safe else "Invalid request"
        logger.warning(
            "request_validation_failed",
            extra={"path": request.url.path, "errors": safe[:5]},
        )
        return _envelope(
            f"Request validation failed: {first}",
            code="validation_error",
            detail=safe[:10],
            request=request,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        if exc.status_code == 404 and not request.url.path.startswith("/api"):
            # Let unknown non-API routes fall through to FastAPI's default 404.
            return _envelope(
                "Not found", code="not_found", request=request, status_code=404
            )
        logger.info(
            "http_exception",
            extra={"status": exc.status_code, "detail": str(exc.detail),
                   "path": request.url.path},
        )
        return _envelope(
            str(exc.detail),
            code=f"http_{exc.status_code}",
            request=request,
            status_code=exc.status_code,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        if type(exc).__name__ in _CLIENT_ERROR_NAMES:
            logger.warning(
                "malformed_upload",
                extra={"error": str(exc), "path": request.url.path},
            )
            return _envelope(
                "The uploaded files could not be parsed. Please send a valid multipart form.",
                code="malformed_upload",
                detail=str(exc) if settings.debug else None,
                request=request,
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        logger.error(
            "unhandled_exception",
            extra={"error": str(exc), "type": type(exc).__name__,
                   "path": request.url.path},
            exc_info=True,
        )
        return _envelope(
            "An unexpected error occurred.",
            code="internal_error",
            detail=f"{type(exc).__name__}: {exc}" if settings.debug else None,
            request=request,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


__all__ = ["register_exception_handlers"]
