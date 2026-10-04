"""Tests for upload validation (stage 0)."""

from __future__ import annotations

import pytest

from config import settings
from models.schemas import ValidationResult
from utils.exceptions import (
    ATSError,
    CorruptedFileError,
    EmptyFileError,
    FileTooLargeError,
    UnsupportedFileTypeError,
)
from utils.file_validator import FileValidator


@pytest.fixture
def validator() -> FileValidator:
    return FileValidator()


def text_bytes(text: str = "John Doe\nSenior Engineer\nPython, SQL, Docker\n") -> bytes:
    return text.encode("utf-8")


class TestAcceptedUploads:
    def test_valid_txt(self, validator: FileValidator):
        result = validator.validate(text_bytes(), "resume.txt", field="resume")
        assert isinstance(result, ValidationResult)
        assert result.is_valid is True
        assert result.extension == ".txt"
        assert result.size_bytes > 0
        assert result.error_message is None

    def test_valid_pdf(self, validator: FileValidator):
        from tests.fixtures import sample_resume_pdf

        result = validator.validate(sample_resume_pdf(), "resume.pdf", field="resume")
        assert result.is_valid is True
        assert result.extension == ".pdf"
        assert result.page_count is not None and result.page_count >= 1
        assert result.is_encrypted is False

    def test_uppercase_extension_is_accepted(self, validator: FileValidator):
        result = validator.validate(text_bytes(), "RESUME.TXT", field="resume")
        assert result.is_valid is True
        assert result.extension == ".txt"

    def test_content_type_is_inferred(self, validator: FileValidator):
        result = validator.validate(text_bytes(), "resume.txt", content_type="text/plain")
        assert result.content_type == "text/plain"

    def test_defaults_from_settings(self, validator: FileValidator):
        assert validator.max_size == settings.max_file_size_bytes
        assert set(validator.allowed_extensions) == {ext.lower() for ext in settings.allowed_extensions}

    def test_validate_pair(self, validator: FileValidator):
        from tests.fixtures import sample_jd_pdf, sample_resume_pdf

        resume_result, jd_result = validator.validate_pair(
            sample_resume_pdf(), sample_jd_pdf(), "resume.pdf", "job_description.pdf"
        )
        assert resume_result.is_valid and jd_result.is_valid


class TestRejectedUploads:
    def test_empty_file(self, validator: FileValidator):
        with pytest.raises(EmptyFileError) as excinfo:
            validator.validate(b"", "resume.txt", field="resume")
        assert isinstance(excinfo.value, ATSError)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "empty_file"

    def test_unsupported_extension(self, validator: FileValidator):
        with pytest.raises(UnsupportedFileTypeError) as excinfo:
            validator.validate(b"not really an image", "photo.jpg", field="resume")
        assert excinfo.value.status_code == 415
        assert excinfo.value.code == "unsupported_file_type"
        assert "jpg" in excinfo.value.message

    def test_executable_extension(self, validator: FileValidator):
        with pytest.raises(UnsupportedFileTypeError):
            validator.validate(b"MZ\x90\x00", "payload.exe", field="resume")

    def test_no_extension(self, validator: FileValidator):
        with pytest.raises(UnsupportedFileTypeError):
            validator.validate(text_bytes(), "resume", field="resume")

    def test_oversized_file(self, validator: FileValidator):
        big = FileValidator(max_size_bytes=1024)
        with pytest.raises(FileTooLargeError) as excinfo:
            big.validate(b"x" * 4096, "resume.txt", field="resume")
        assert excinfo.value.status_code == 413
        assert excinfo.value.code == "file_too_large"

    def test_pdf_with_wrong_magic_bytes(self, validator: FileValidator):
        with pytest.raises(CorruptedFileError) as excinfo:
            validator.validate(b"NOT A PDF AT ALL", "resume.pdf", field="resume")
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "corrupted_file"

    def test_truncated_pdf(self, validator: FileValidator):
        with pytest.raises(CorruptedFileError) as excinfo:
            validator.validate(b"%PDF-1.4\nbroken body", "resume.pdf", field="resume")
        assert "startxref" in excinfo.value.detail or excinfo.value.code == "corrupted_file"

    def test_docx_with_wrong_signature(self, validator: FileValidator):
        with pytest.raises(CorruptedFileError):
            validator.validate(b"plain text masquerading", "resume.docx", field="resume")

    def test_field_name_appears_in_the_message(self, validator: FileValidator):
        with pytest.raises(ATSError) as excinfo:
            validator.validate(b"", "jd.txt", field="job_description")
        assert "job description" in excinfo.value.message

    def test_error_context_carries_the_field(self, validator: FileValidator):
        with pytest.raises(ATSError) as excinfo:
            validator.validate(b"", "resume.txt", field="resume")
        assert excinfo.value.context.get("field") == "resume"

    def test_structure_check_can_be_skipped(self, validator: FileValidator):
        """`require_pdf_structure=False` still enforces magic bytes but not parsing."""
        result = validator.validate(
            b"%PDF-1.4\nno real structure", "resume.pdf", require_pdf_structure=False
        )
        assert result.is_valid is True


class TestFilenameSanitisation:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("/etc/passwd", "passwd"),
            ("../../secrets.txt", "secrets.txt"),
            ("C:\\Users\\me\\resume.pdf", "resume.pdf"),
            ("my resume (final).pdf", "my resume (final).pdf"),
            ("bad<>|chars?.txt", "bad___chars_.txt"),
            ("", "document"),
        ],
    )
    def test_sanitizes(self, raw: str, expected: str):
        assert FileValidator.sanitize_filename(raw) == expected

    def test_long_names_are_truncated(self):
        assert len(FileValidator.sanitize_filename("a" * 400 + ".txt")) <= 180

    def test_null_bytes_are_removed(self):
        assert "\x00" not in FileValidator.sanitize_filename("resume\x00.pdf")


class TestFileLikeUploads:
    class _FakeUpload:
        """Mimics the parts of Starlette's UploadFile the validator uses."""

        def __init__(self, payload: bytes, filename: str, content_type: str = "text/plain"):
            self._payload = payload
            self.filename = filename
            self.content_type = content_type

        async def read(self) -> bytes:  # pragma: no cover - sync fallback used
            return self._payload

        def seek(self, offset: int) -> None:
            pass

    def test_accepts_file_like_objects(self, validator: FileValidator):
        import io

        handle = io.BytesIO(text_bytes())
        handle.name = "resume.txt"
        result = validator.validate(handle, "resume.txt", field="resume")
        assert result.is_valid is True
