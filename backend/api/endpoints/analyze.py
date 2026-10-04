"""``POST /api/analyze`` — the core analysis endpoint.

Accepts a multipart form with two files (``resume``, ``job_description``) plus
optional tuning fields, runs the 14-stage NLP pipeline in a worker thread (it is
CPU-bound), persists the result and returns the full
:class:`~models.schemas.AnalysisResponse`.

Contract (per specification)
----------------------------
* 422 — invalid/empty/corrupted upload, or too little extractable text
* 413 / 415 — file too large / unsupported type
* 408 — analysis exceeded ``settings.analysis_timeout_seconds``
* 429 — more than ``settings.analyze_rate_limit`` (10/min per IP)
* 500 — unrecoverable NLP failure
"""

# NOTE: this module deliberately does NOT use ``from __future__ import
# annotations``. slowapi's ``@limiter.limit`` wraps the endpoint in a function
# whose ``__globals__`` point at slowapi's own module, so FastAPI could not
# resolve string annotations like ``UploadFile`` ("Invalid args for response
# field! Hint: check that ForwardRef('UploadFile') is a valid Pydantic field
# type"). Keeping real annotation objects avoids that entirely.

import asyncio
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.rate_limiter import limiter
from config import settings
from models.database import session_scope
from models.schemas import AnalysisResponse, ErrorResponse
from services.analysis_service import get_analysis_service
from utils.exceptions import AnalysisTimeoutError, FileValidationError
from utils.file_validator import file_validator
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["analysis"])

#: Largest body we are willing to buffer (both files + multipart overhead).
_MAX_TOTAL_BYTES = settings.max_file_size_bytes * 2 + (512 * 1024)


def _parse_weights(raw: Optional[str]) -> Optional[Dict[str, float]]:
    """Parse the optional ``weights`` form field (JSON object or k=v pairs)."""
    if not raw or not raw.strip():
        return None
    text = raw.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return {str(k): float(v) for k, v in parsed.items()}
        raise ValueError("weights must be a JSON object")
    except (json.JSONDecodeError, ValueError, TypeError):
        # Fall back to "keyword_match=0.3,skill_match=0.3" style input.
        weights: Dict[str, float] = {}
        for chunk in text.replace(";", ",").split(","):
            if "=" not in chunk:
                continue
            key, _, value = chunk.partition("=")
            try:
                weights[key.strip().lower()] = float(value)
            except ValueError:
                continue
        if not weights:
            raise FileValidationError(
                "The 'weights' field must be a JSON object such as "
                '{"keyword_match": 0.25, "semantic_similarity": 0.30}.',
                context={"field": "weights", "received": text[:120]},
            )
        return weights


def _parse_int(raw: Optional[str], field: str, minimum: int, maximum: int) -> Optional[int]:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        raise FileValidationError(
            f"The '{field}' field must be an integer.", context={"field": field}
        ) from None
    if not minimum <= value <= maximum:
        raise FileValidationError(
            f"The '{field}' field must be between {minimum} and {maximum}.",
            context={"field": field, "received": value},
        )
    return value


def _parse_bool(raw: Any, default: bool = False) -> bool:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


async def _read_upload(upload: UploadFile, field: str) -> bytes:
    """Read an upload into memory with a hard size guard."""
    data = await upload.read()
    if len(data) > settings.max_file_size_bytes:
        raise FileValidationError(
            f"The {field.replace('_', ' ')} file is "
            f"{len(data) / (1024 * 1024):.1f} MB, which exceeds the "
            f"{settings.max_file_size_mb} MB limit.",
            context={"field": field, "size_bytes": len(data)},
        )
    return data


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse a resume against a job description",
    description=(
        "Upload a resume and a job description (PDF, TXT or DOCX). Returns the "
        "overall match score, the weighted breakdown, matched/missing skills, "
        "keyword and entity analysis, per-section scores, an ATS formatting "
        "check and prioritised recommendations."
    ),
    responses={
        413: {"model": ErrorResponse, "description": "File too large"},
        415: {"model": ErrorResponse, "description": "Unsupported file type"},
        422: {"model": ErrorResponse, "description": "Validation or extraction failure"},
        408: {"model": ErrorResponse, "description": "Analysis timed out"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "NLP pipeline failure"},
    },
)
@limiter.limit(settings.analyze_rate_limit)
async def analyze(
    request: Request,
    # ``response`` is required by slowapi: it appends the X-RateLimit-* headers
    # to this object because the endpoint returns a Pydantic model, not a
    # starlette Response.
    response: Response,
    resume: UploadFile = File(..., description="Resume file (PDF, TXT or DOCX)"),
    job_description: UploadFile = File(..., description="Job description (PDF, TXT or DOCX)"),
    weights: Optional[str] = Form(None, description="Optional JSON object of score weights"),
    top_keywords: Optional[str] = Form(None, description="How many keywords to return (5-60)"),
    include_section_text: Optional[str] = Form(None, description="Return full section text"),
    persist: Optional[str] = Form(None, description="Store in history (default true)"),
    session: AsyncSession = Depends(session_scope),
) -> AnalysisResponse:
    """Run the full pipeline for the two uploaded documents."""
    resume_bytes = await _read_upload(resume, "resume")
    jd_bytes = await _read_upload(job_description, "job_description")

    if len(resume_bytes) + len(jd_bytes) > _MAX_TOTAL_BYTES:
        raise FileValidationError(
            "The combined upload size exceeds the allowed maximum.",
            context={"total_bytes": len(resume_bytes) + len(jd_bytes)},
        )

    resume_name = file_validator.sanitize_filename(resume.filename or "resume.pdf")
    jd_name = file_validator.sanitize_filename(job_description.filename or "job_description.pdf")

    # Validation raises typed 4xx errors (extension, size, magic bytes, PDF
    # structure, encryption) before any NLP work happens.
    file_validator.validate(
        resume_bytes, resume_name, content_type=resume.content_type, field="resume"
    )
    file_validator.validate(
        jd_bytes, jd_name, content_type=job_description.content_type, field="job_description"
    )

    parsed_weights = _parse_weights(weights)
    parsed_top_keywords = _parse_int(top_keywords, "top_keywords", 5, 60)
    want_section_text = _parse_bool(include_section_text, default=False)
    want_persist = _parse_bool(persist, default=True)

    service = get_analysis_service()
    logger.info(
        "analysis_requested",
        extra={
            "resume": resume_name,
            "resume_bytes": len(resume_bytes),
            "jd": jd_name,
            "jd_bytes": len(jd_bytes),
            "weights": parsed_weights,
            "top_keywords": parsed_top_keywords,
            "client": request.client.host if request.client else "unknown",
        },
    )

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(
                service.run_full_analysis,
                resume_bytes,
                jd_bytes,
                resume_filename=resume_name,
                jd_filename=jd_name,
                resume_size_bytes=len(resume_bytes),
                jd_size_bytes=len(jd_bytes),
                weights=parsed_weights,
                top_keywords=parsed_top_keywords,
                include_section_text=want_section_text,
            ),
            timeout=settings.analysis_timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        logger.error(
            "analysis_timeout",
            extra={"timeout_seconds": settings.analysis_timeout_seconds,
                   "resume": resume_name},
        )
        raise AnalysisTimeoutError(
            f"Analysis exceeded the {settings.analysis_timeout_seconds}s time budget.",
            context={"timeout_seconds": settings.analysis_timeout_seconds},
        ) from exc

    if want_persist:
        try:
            from models.database import AnalysisRepository

            await AnalysisRepository(session).save(
                result,
                resume_filename=resume_name,
                jd_filename=jd_name,
                preview=result.verdict[:280],
            )
        except Exception as exc:  # noqa: BLE001 - history is best effort
            logger.error(
                "analysis_persist_failed",
                extra={"error": str(exc), "id": result.id},
            )
            result.nlp_metadata.warnings.append(
                "The result could not be saved to history, but the analysis succeeded."
            )

    logger.info(
        "analysis_served",
        extra={
            "id": result.id,
            "score": result.overall_score,
            "grade": result.grade,
            "duration_ms": result.nlp_metadata.processing_time_ms,
            "persisted": want_persist,
        },
    )
    return result


__all__ = ["router"]
