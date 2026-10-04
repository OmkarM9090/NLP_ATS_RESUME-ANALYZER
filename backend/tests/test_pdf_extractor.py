"""Tests for stage 1 — PDF/TXT/DOCX text extraction (with OCR degradation)."""

from __future__ import annotations

import pytest

from core.pdf_extractor import OCRSupport, PDFExtractor
from models.schemas import ExtractedText, ExtractionMethod
from tests.fixtures import SAMPLE_JD_TEXT, SAMPLE_RESUME_TEXT, build_pdf, sample_jd_pdf, sample_resume_pdf
from utils.exceptions import ATSError, PDFExtractionError


@pytest.fixture(scope="module")
def pdf_extractor() -> PDFExtractor:
    return PDFExtractor()


class TestPDFExtraction:
    def test_extracts_the_sample_resume(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract(sample_resume_pdf(), "resume.pdf")
        assert isinstance(result, ExtractedText)
        assert result.extraction_method == ExtractionMethod.PDFPLUMBER
        assert result.is_scanned is False
        assert result.page_count >= 1
        assert "john doe" in result.full_text.lower()
        assert "machine learning" in result.full_text.lower()

    def test_extracts_the_sample_job_description(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract(sample_jd_pdf(), "job_description.pdf")
        assert "TechCorp" in result.full_text
        assert result.char_count == len(result.full_text)

    def test_key_resume_content_survives(self, pdf_extractor: PDFExtractor):
        text = pdf_extractor.extract(sample_resume_pdf(), "resume.pdf").full_text
        lowered = text.lower()
        for needle in ("experience", "education", "skills", "stanford", "tensorflow", "kubernetes"):
            assert needle in lowered, needle

    def test_multi_page_document(self, pdf_extractor: PDFExtractor):
        payload = build_pdf(SAMPLE_RESUME_TEXT + "\n\n" + SAMPLE_JD_TEXT)
        result = pdf_extractor.extract(payload, "combined.pdf")
        assert result.page_count >= 1
        assert "john doe" in result.full_text.lower()
        assert "techcorp" in result.full_text.lower()

    def test_extract_pair(self, pdf_extractor: PDFExtractor):
        resume, jd = pdf_extractor.extract_pair(sample_resume_pdf(), sample_jd_pdf(),
                                                "resume.pdf", "job_description.pdf")
        assert "john doe" in resume.full_text.lower()
        assert "techcorp" in jd.full_text.lower()

    def test_warnings_list_is_always_present(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract(sample_resume_pdf(), "resume.pdf")
        assert isinstance(result.warnings, list)


class TestPlainTextExtraction:
    def test_txt_file(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract(SAMPLE_RESUME_TEXT.encode("utf-8"), "resume.txt")
        assert result.extraction_method == ExtractionMethod.PLAIN_TEXT
        assert result.page_count in (0, 1)
        # Line indentation is normalised away, so compare content word-for-word.
        normalise = lambda text: " ".join(text.split()).lower()  # noqa: E731
        assert normalise(result.full_text) == normalise(SAMPLE_RESUME_TEXT)

    def test_utf8_and_unicode(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract("Café résumé — naïve 日本語".encode("utf-8"), "notes.txt")
        assert "Café" in result.full_text

    def test_latin1_fallback(self, pdf_extractor: PDFExtractor):
        payload = "Résumé caf\xe9".encode("latin-1")
        result = pdf_extractor.extract(payload, "resume.txt")
        assert result.full_text  # decoded by the fallback chain, never empty

    def test_crlf_line_endings(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract(b"Line one\r\nLine two\r\n", "resume.txt")
        assert "Line one" in result.full_text and "Line two" in result.full_text


class TestFailureModes:
    def test_corrupted_pdf_raises(self, pdf_extractor: PDFExtractor):
        with pytest.raises(PDFExtractionError) as excinfo:
            pdf_extractor.extract(b"%PDF-1.4\nthis is not a real pdf", "resume.pdf")
        assert isinstance(excinfo.value, ATSError)
        assert excinfo.value.status_code == 422
        assert excinfo.value.code == "pdf_extraction_error"

    def test_random_binary_raises(self, pdf_extractor: PDFExtractor):
        with pytest.raises(ATSError):
            pdf_extractor.extract(bytes(range(256)) * 4, "resume.pdf")

    def test_empty_pdf_like_payload(self, pdf_extractor: PDFExtractor):
        with pytest.raises(ATSError):
            pdf_extractor.extract(b"", "resume.pdf")

    def test_pdf_without_any_text_degrades_to_ocr_or_error(self, pdf_extractor: PDFExtractor):
        """A text-less PDF must not silently return an empty document."""
        blank = build_pdf("", scanned=True)
        try:
            result = pdf_extractor.extract(blank, "scanned.pdf")
        except ATSError as exc:
            assert exc.status_code == 422
        else:
            assert result.is_scanned is True or result.warnings


class TestOCRSupport:
    def test_check_reports_availability(self):
        support = OCRSupport.check()
        assert isinstance(support, OCRSupport)
        assert support.is_available() in (True, False)

    def test_is_available_is_a_bool(self):
        assert isinstance(OCRSupport.is_available(), bool)

    def test_in_sandbox_ocr_is_unavailable(self):
        """tesseract/poppler cannot be installed here — extraction must degrade."""
        assert OCRSupport.is_available() is False

    def test_extractor_records_ocr_availability(self, pdf_extractor: PDFExtractor):
        result = pdf_extractor.extract(sample_resume_pdf(), "resume.pdf")
        assert result.ocr_available in (True, False)
        assert result.ocr_attempted is False  # text PDFs never need OCR


class TestExtractorConstruction:
    def test_ocr_can_be_disabled(self):
        extractor = PDFExtractor(enable_ocr=False)
        result = extractor.extract(sample_resume_pdf(), "resume.pdf")
        assert result.full_text

    def test_ocr_settings_are_configurable(self):
        extractor = PDFExtractor(enable_ocr=True, ocr_languages="eng+fra", dpi=200)
        assert extractor.enable_ocr is True
        assert extractor.ocr_languages == "eng+fra"
        assert extractor.dpi == 200

    def test_defaults_come_from_settings(self):
        from config import settings

        extractor = PDFExtractor()
        assert extractor.enable_ocr == settings.enable_ocr_fallback
        assert extractor.ocr_languages == settings.ocr_languages
