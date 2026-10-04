"""Application-specific exception hierarchy.

Every layer of the pipeline raises one of these so that the API middleware can
translate them into meaningful HTTP responses instead of leaking tracebacks.
"""

from __future__ import annotations

from typing import Any, Optional


class ATSError(Exception):
    """Base class for all domain errors raised by this service."""

    #: HTTP status code used by the global error handler.
    status_code: int = 500
    #: Stable machine-readable code surfaced to clients.
    code: str = "internal_error"
    #: Safe, user-facing message.
    default_message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: Optional[str] = None,
        *,
        detail: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
    ) -> None:
        self.message = message or self.default_message
        self.detail = detail
        self.context = context or {}
        # Instance-level overrides fall back to the class defaults, so a caller
        # can narrow a generic error ("not_found" -> "analysis_not_found").
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Serialise for the error response envelope."""
        return {
            "error": self.message,
            "detail": self.detail,
            "code": self.code,
            "context": self.context or None,
        }


# --------------------------------------------------------------------------- #
# Validation / upload
# --------------------------------------------------------------------------- #
class FileValidationError(ATSError):
    """Raised when an uploaded file fails validation."""

    status_code = 422
    code = "file_validation_error"
    default_message = "The uploaded file is not valid."


class InvalidRequestError(ATSError):
    """A request parameter (form field, query arg) could not be understood.

    Uses the same ``validation_error`` code as FastAPI's own request validation
    handler so clients only need to special-case one 422 shape.
    """

    status_code = 422
    code = "validation_error"


class UnsupportedFileTypeError(FileValidationError):
    status_code = 415
    code = "unsupported_file_type"
    default_message = "Unsupported file type. Please upload a PDF."


class FileTooLargeError(FileValidationError):
    status_code = 413
    code = "file_too_large"
    default_message = "The uploaded file exceeds the maximum allowed size."


class EmptyFileError(FileValidationError):
    status_code = 422
    code = "empty_file"
    default_message = "The uploaded file is empty."


class CorruptedFileError(FileValidationError):
    status_code = 422
    code = "corrupted_file"
    default_message = "The uploaded file appears to be corrupted and could not be read."


class EncryptedFileError(FileValidationError):
    status_code = 422
    code = "encrypted_file"
    default_message = "The uploaded file is password protected. Please remove the password and try again."


# --------------------------------------------------------------------------- #
# Extraction / NLP
# --------------------------------------------------------------------------- #
class PDFExtractionError(ATSError):
    """Raised when text cannot be extracted from a document."""

    status_code = 422
    code = "pdf_extraction_error"
    default_message = "Could not extract text from this document."


class NLPProcessingError(ATSError):
    """Raised when the NLP pipeline fails irrecoverably."""

    status_code = 500
    code = "nlp_processing_error"
    default_message = "The NLP pipeline failed while processing the documents."


class ModelLoadError(ATSError):
    """Raised when a model cannot be loaded or warmed up."""

    status_code = 503
    code = "model_load_error"
    default_message = "The NLP models are still loading. Please retry in a moment."


class AnalysisTimeoutError(ATSError):
    """Raised when analysis exceeds the configured time budget."""

    status_code = 408
    code = "analysis_timeout"
    default_message = "Analysis took too long. Please try again with a smaller document."


class InsufficientTextError(ATSError):
    """Raised when a document contains too little text to analyse."""

    status_code = 422
    code = "insufficient_text"
    default_message = "Not enough readable text was found in the document to perform an analysis."


# --------------------------------------------------------------------------- #
# Persistence / API
# --------------------------------------------------------------------------- #
class NotFoundError(ATSError):
    """Raised when a requested resource does not exist."""

    status_code = 404
    code = "not_found"
    default_message = "Resource not found."


class DatabaseError(ATSError):
    """Raised on persistence failures."""

    status_code = 500
    code = "database_error"
    default_message = "A database error occurred."


class RateLimitExceededError(ATSError):
    """Raised when the caller exceeds the configured rate limit."""

    status_code = 429
    code = "rate_limit_exceeded"
    default_message = "Too many requests. Please slow down."


__all__ = [
    "ATSError",
    "FileValidationError",
    "InvalidRequestError",
    "UnsupportedFileTypeError",
    "FileTooLargeError",
    "EmptyFileError",
    "CorruptedFileError",
    "EncryptedFileError",
    "PDFExtractionError",
    "NLPProcessingError",
    "ModelLoadError",
    "AnalysisTimeoutError",
    "InsufficientTextError",
    "NotFoundError",
    "DatabaseError",
    "RateLimitExceededError",
]
