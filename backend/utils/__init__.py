"""Utility package: validation, text helpers and structured logging."""

from utils.file_validator import FileValidator, FileValidationError, ValidationResult
from utils.logger import get_logger, log_stage, set_request_id
from utils.text_utils import (
    chunk_text,
    clamp,
    collapse_whitespace,
    dedupe_preserve_order,
    normalize_unicode,
    safe_ratio,
    truncate,
)

__all__ = [
    "FileValidator",
    "FileValidationError",
    "ValidationResult",
    "get_logger",
    "log_stage",
    "set_request_id",
    "chunk_text",
    "clamp",
    "collapse_whitespace",
    "dedupe_preserve_order",
    "normalize_unicode",
    "safe_ratio",
    "truncate",
]
