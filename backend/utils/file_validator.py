"""Upload validation.

Checks, in order: presence, extension/MIME type, size limits, magic bytes,
parseability, encryption and page-count sanity. Every failure raises a
typed :class:`~utils.exceptions.FileValidationError` subclass so the API can
return an actionable 4xx response.
"""

from __future__ import annotations

import io
import os
import re
from pathlib import Path
from typing import Optional, Union

from config import settings
from models.schemas import ValidationResult
from utils.exceptions import (
    CorruptedFileError,
    EmptyFileError,
    EncryptedFileError,
    FileTooLargeError,
    FileValidationError,
    UnsupportedFileTypeError,
)
from utils.logger import get_logger

logger = get_logger(__name__)

# Magic bytes for the formats we accept.
_MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".txt": (),  # no reliable signature
    ".docx": (b"PK\x03\x04",),
    ".doc": (b"\xd0\xcf\x11\xe0",),
}

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._\-\s()+]")


class FileValidator:
    """Stateless validator for uploaded resume / job-description files."""

    MAX_SIZE = settings.max_file_size_bytes
    ALLOWED_TYPES = tuple(settings.allowed_extensions)

    def __init__(
        self,
        max_size_bytes: Optional[int] = None,
        allowed_extensions: Optional[tuple[str, ...]] = None,
    ) -> None:
        self.max_size = max_size_bytes or self.MAX_SIZE
        self.allowed_extensions = tuple(
            ext.lower() for ext in (allowed_extensions or self.ALLOWED_TYPES)
        )

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def validate(
        self,
        file: Union[bytes, "UploadFileLike"],
        filename: Optional[str] = None,
        *,
        content_type: Optional[str] = None,
        field: str = "file",
        require_pdf_structure: bool = True,
    ) -> ValidationResult:
        """Validate an upload and return a :class:`ValidationResult`.

        Parameters
        ----------
        file:
            Either raw bytes or a file-like/Starlette ``UploadFile`` object.
        filename:
            Original filename (used for extension + display checks).
        field:
            Logical field name, used in error messages ("resume" / "job description").
        require_pdf_structure:
            When true (default) PDFs are opened to confirm they parse and are
            not encrypted.
        """
        raw, resolved_name, resolved_type = self._read(file, filename, content_type)
        label = field.replace("_", " ")

        result = ValidationResult(
            filename=self.sanitize_filename(resolved_name or f"{field}.bin"),
            size_bytes=len(raw),
            extension=Path(resolved_name or "").suffix.lower(),
            content_type=resolved_type or "application/octet-stream",
        )

        # 1. Empty payload ------------------------------------------------ #
        if not raw:
            result.is_valid = False
            result.error_message = f"The {label} file is empty (0 bytes)."
            raise EmptyFileError(result.error_message, context={"field": field})

        # 2. Extension ---------------------------------------------------- #
        if result.extension not in self.allowed_extensions:
            allowed = ", ".join(self.allowed_extensions)
            result.is_valid = False
            result.error_message = (
                f"The {label} file type '{result.extension or 'unknown'}' is not supported. "
                f"Allowed types: {allowed}."
            )
            raise UnsupportedFileTypeError(result.error_message, context={"field": field})

        # 3. Size --------------------------------------------------------- #
        if len(raw) > self.max_size:
            limit_mb = self.max_size / (1024 * 1024)
            actual_mb = len(raw) / (1024 * 1024)
            result.is_valid = False
            result.error_message = (
                f"The {label} file is {actual_mb:.1f} MB, which exceeds the {limit_mb:.0f} MB limit."
            )
            raise FileTooLargeError(result.error_message, context={"field": field})

        # 4. Magic bytes -------------------------------------------------- #
        if not self._matches_signature(raw, result.extension):
            result.is_valid = False
            result.error_message = (
                f"The {label} file claims to be a '{result.extension}' file but its contents "
                "do not match. The file may be corrupted or renamed."
            )
            raise CorruptedFileError(result.error_message, context={"field": field})

        # 5. Structural validation (PDF) ---------------------------------- #
        if result.extension == ".pdf" and require_pdf_structure:
            self._validate_pdf(raw, result, label, field)

        logger.info(
            "file_validated",
            extra={
                "field": field,
                "file_name": result.filename,
                "size_bytes": result.size_bytes,
                "pages": result.page_count,
                "encrypted": result.is_encrypted,
            },
        )
        return result

    def validate_pair(
        self, resume: bytes, job_description: bytes, resume_name: str, jd_name: str
    ) -> tuple[ValidationResult, ValidationResult]:
        """Validate both uploads, collecting errors for a combined response."""
        resume_result = self.validate(resume, resume_name, field="resume")
        jd_result = self.validate(job_description, jd_name, field="job_description")
        return resume_result, jd_result

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def sanitize_filename(name: str, max_length: int = 180) -> str:
        """Strip path components and unsafe characters from a filename."""
        # basename() is platform-specific: on POSIX it leaves "C:\\dir\\file.pdf"
        # intact, so split on both separators explicitly.
        raw = (name or "").replace("\x00", "")
        for separator in ("\\", "/"):
            if separator in raw:
                raw = raw.rsplit(separator, 1)[-1]
        name = os.path.basename(raw).strip()
        name = _SAFE_NAME_RE.sub("_", name)
        return name[:max_length] or "document"

    def _read(
        self,
        file: Union[bytes, "UploadFileLike"],
        filename: Optional[str],
        content_type: Optional[str],
    ) -> tuple[bytes, Optional[str], Optional[str]]:
        """Normalise the various upload representations into raw bytes."""
        if isinstance(file, (bytes, bytearray)):
            return bytes(file), filename, content_type

        data = getattr(file, "file", None)
        if data is not None and hasattr(data, "read"):
            try:
                pos = data.tell()
                data.seek(0)
                raw = data.read()
                data.seek(pos)
            except (OSError, ValueError, AttributeError):
                raw = data.read()
        elif hasattr(file, "read"):
            raw = file.read()
        else:
            raw = bytes(file)

        if isinstance(raw, str):
            raw = raw.encode("utf-8", errors="replace")
        return (
            raw,
            filename or getattr(file, "filename", None),
            content_type or getattr(file, "content_type", None),
        )

    def _matches_signature(self, raw: bytes, extension: str) -> bool:
        signatures = _MAGIC_SIGNATURES.get(extension)
        if signatures is None:
            return True  # unknown extension -> nothing to check
        if not signatures:
            return True  # extension has no signature requirement (.txt)
        head = raw[:1024]
        return any(head.startswith(sig) or sig in head[:16] for sig in signatures)

    def _validate_pdf(self, raw: bytes, result: ValidationResult, label: str, field: str) -> None:
        """Open the PDF with pypdf (fast) to check structure and encryption."""
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(raw), strict=False)
            if reader.is_encrypted:
                # Some PDFs are encrypted with an empty owner password and can
                # still be read; only fail when decryption is truly required.
                try:
                    decrypted = reader.decrypt("")
                except Exception:  # pragma: no cover - defensive
                    decrypted = 0
                if not decrypted:
                    result.is_valid = False
                    result.is_encrypted = True
                    result.error_message = (
                        f"The {label} PDF is password protected. "
                        "Please remove the password and upload it again."
                    )
                    raise EncryptedFileError(result.error_message, context={"field": field})
                result.is_encrypted = True
            result.page_count = len(reader.pages)
            if result.page_count == 0:
                result.is_valid = False
                result.error_message = f"The {label} PDF has no pages."
                raise CorruptedFileError(result.error_message, context={"field": field})
            if result.page_count > 50:
                logger.warning(
                    "large_pdf", extra={"field": field, "pages": result.page_count}
                )
        except (EncryptedFileError, CorruptedFileError):
            raise
        except Exception as exc:  # noqa: BLE001 - any parse failure = corrupted
            logger.warning(
                "pdf_structure_check_failed",
                extra={"field": field, "error": str(exc)},
            )
            result.is_valid = False
            result.error_message = (
                f"The {label} PDF could not be read. It may be corrupted or not a valid PDF."
            )
            raise CorruptedFileError(
                result.error_message, detail=str(exc), context={"field": field}
            ) from exc


# Duck-typed alias so the signature above stays readable without importing
# starlette at module scope (keeps this file usable from scripts/tests).
class UploadFileLike:  # pragma: no cover - typing helper only
    filename: Optional[str]
    content_type: Optional[str]
    file: io.IOBase


#: Module-level singleton used by the API layer.
file_validator = FileValidator()
