"""Stage 1 — document text extraction with OCR fallback.

Strategy
--------
1. ``pdfplumber`` extracts text (and detects tables/images) from text-based PDFs.
2. If a page yields almost no text it is treated as scanned and routed to OCR:
   ``pdf2image`` rasterises the page, ``pytesseract`` reads it.
3. Per-page results are merged, so a mixed document (typed cover page + scanned
   certificate) produces a single hybrid text.
4. If OCR binaries are missing the extractor still returns the best text it has
   and records a warning — it only raises :class:`PDFExtractionError` when the
   document is genuinely unreadable.

Plain ``.txt`` and ``.docx`` uploads are also accepted (the latter via a
dependency-free OOXML reader) because many ATS exports are Word documents.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from config import settings
from models.schemas import ExtractedText, ExtractionMethod
from utils.exceptions import PDFExtractionError
from utils.logger import get_logger
from utils.text_utils import collapse_whitespace, strip_control_chars

logger = get_logger(__name__)

_XML_TAG_RE = re.compile(r"<[^>]+>")
_PARAGRAPH_RE = re.compile(r"</w:p>")
_WORD_BREAK_RE = re.compile(r"<w:tab[^>]*/>|<w:br[^>]*/>")
_MIN_CHARS_PER_PAGE = 40


class OCRSupport:
    """Detects (and caches) whether the OCR toolchain is installed."""

    _checked = False
    tesseract_binary: Optional[str] = None
    poppler_available: bool = False
    error: Optional[str] = None

    @classmethod
    def check(cls) -> "OCRSupport":
        if cls._checked:
            return cls()
        cls.tesseract_binary = shutil.which("tesseract")
        has_poppler = bool(shutil.which("pdftoppm") or shutil.which("pdftocairo"))
        cls.poppler_available = has_poppler

        if not cls.tesseract_binary:
            cls.error = (
                "tesseract binary not found. Install with "
                "`apt-get install -y tesseract-ocr` (Debian/Ubuntu), "
                "`apk add tesseract-ocr` (Alpine) or `brew install tesseract` (macOS)."
            )
        elif not has_poppler:
            cls.error = (
                "poppler-utils not found (needed to rasterise PDF pages for OCR). "
                "Install with `apt-get install -y poppler-utils` or `brew install poppler`."
            )
        else:
            try:
                import pytesseract  # noqa: F401
                from pdf2image import convert_from_bytes  # noqa: F401
            except Exception as exc:  # pragma: no cover
                cls.error = f"OCR python packages unavailable: {exc}"

        cls._checked = True
        logger.info(
            "ocr_support_checked",
            extra={
                "tesseract": cls.tesseract_binary,
                "poppler": cls.poppler_available,
                "available": cls.is_available(),
            },
        )
        return cls()

    @classmethod
    def is_available(cls) -> bool:
        cls.check()
        return bool(cls.tesseract_binary and cls.poppler_available and not cls.error)


class PDFExtractor:
    """Extract text from PDF / TXT / DOCX uploads."""

    def __init__(
        self,
        enable_ocr: Optional[bool] = None,
        ocr_languages: Optional[str] = None,
        dpi: Optional[int] = None,
    ) -> None:
        self.enable_ocr = settings.enable_ocr_fallback if enable_ocr is None else enable_ocr
        self.ocr_languages = ocr_languages or settings.ocr_languages
        self.dpi = dpi or settings.ocr_dpi

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def extract(self, file_bytes: bytes, filename: str = "document.pdf") -> ExtractedText:
        """Extract text from raw document bytes.

        Raises
        ------
        PDFExtractionError
            When no text can be recovered by any available method.
        """
        if not file_bytes:
            raise PDFExtractionError(
                "The uploaded file is empty, so no text could be extracted.",
                context={"filename": filename},
            )

        suffix = Path(filename).suffix.lower()
        if suffix in {".txt", ".md", ".csv", ""} and not self._looks_like_pdf(file_bytes):
            return self._from_plain_text(file_bytes, filename)
        if suffix == ".docx":
            return self._from_docx(file_bytes, filename)
        return self._from_pdf(file_bytes, filename)

    def extract_pair(self, resume_bytes: bytes, jd_bytes: bytes,
                     resume_name: str = "resume.pdf", jd_name: str = "job_description.pdf"
                     ) -> Tuple[ExtractedText, ExtractedText]:
        """Extract both documents, collecting warnings without aborting."""
        return (
            self.extract(resume_bytes, resume_name),
            self.extract(jd_bytes, jd_name),
        )

    # ------------------------------------------------------------------ #
    # PDF
    # ------------------------------------------------------------------ #
    def _from_pdf(self, file_bytes: bytes, filename: str) -> ExtractedText:
        warnings: List[str] = []
        pages_text: List[str] = []
        tables_total = 0
        images_total = 0
        ocr_attempted = False
        ocr_pages = 0

        try:
            import pdfplumber
        except ImportError as exc:  # pragma: no cover
            raise PDFExtractionError(
                "pdfplumber is not installed, so PDF files cannot be processed.",
                detail=str(exc),
            ) from exc

        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                page_count = len(pdf.pages)
                if page_count == 0:
                    raise PDFExtractionError(
                        "The PDF contains no pages.", context={"filename": filename}
                    )

                scanned_pages: List[int] = []
                for index, page in enumerate(pdf.pages, start=1):
                    text = self._extract_page_text(page)
                    try:
                        tables_total += len(page.find_tables())
                    except Exception:  # pragma: no cover - table detection is best effort
                        pass
                    try:
                        images_total += len(page.images)
                    except Exception:  # pragma: no cover
                        pass

                    if len(text.strip()) < _MIN_CHARS_PER_PAGE:
                        scanned_pages.append(index)
                        pages_text.append(text)
                    else:
                        pages_text.append(text)

                # ---- OCR fallback for the pages that produced no text ----- #
                if scanned_pages and self.enable_ocr:
                    ocr_attempted = True
                    ocr_results = self._ocr_pages(file_bytes, scanned_pages, warnings)
                    for page_number, ocr_text in ocr_results.items():
                        idx = page_number - 1
                        if 0 <= idx < len(pages_text) and len(ocr_text.strip()) > len(
                            pages_text[idx].strip()
                        ):
                            pages_text[idx] = ocr_text
                            ocr_pages += 1
                elif scanned_pages and not self.enable_ocr:
                    OCRSupport.check()
                    if not OCRSupport.is_available():
                        warnings.append(
                            f"{len(scanned_pages)} page(s) appear to be scanned images but OCR is "
                            f"not available in this environment. {OCRSupport.error or ''}".strip()
                        )
        except PDFExtractionError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "pdfplumber_extraction_failed",
                extra={"file_name": filename, "error": str(exc)},
                exc_info=True,
            )
            # Last resort: try OCR over the whole document.
            if self.enable_ocr and OCRSupport.is_available():
                ocr_attempted = True
                whole_doc = self._ocr_pages(
                    file_bytes, list(range(1, settings.ocr_max_pages + 1)), warnings
                )
                pages_text = [whole_doc.get(i, "") for i in range(1, len(whole_doc) + 1)]
                page_count = len(pages_text)
                tables_total = images_total = 0
            else:
                raise PDFExtractionError(
                    f"Could not read the PDF '{filename}'. The file may be corrupted.",
                    detail=str(exc),
                    context={"filename": filename},
                ) from exc

        full_text = collapse_whitespace(strip_control_chars("\n".join(pages_text)))

        method = ExtractionMethod.PDFPLUMBER
        if ocr_pages and ocr_pages >= len(pages_text):
            method = ExtractionMethod.OCR_TESSERACT
        elif ocr_pages:
            method = ExtractionMethod.HYBRID

        is_scanned = method in {ExtractionMethod.OCR_TESSERACT, ExtractionMethod.HYBRID} or (
            bool(pages_text) and len(full_text) < _MIN_CHARS_PER_PAGE * len(pages_text)
            and ocr_attempted
        )

        if not full_text.strip():
            hint = (
                "OCR is not available in this environment."
                if not OCRSupport.is_available()
                else "OCR did not produce readable text."
            )
            raise PDFExtractionError(
                f"Cannot extract text from '{filename}'. It appears to be an image-only or "
                f"scanned document. {hint}",
                context={"filename": filename, "pages": page_count},
            )

        if len(full_text.strip()) < settings.min_extracted_chars:
            warnings.append(
                f"Only {len(full_text.strip())} characters were extracted — the analysis "
                "may be unreliable for such a short document."
            )
        if images_total > 3 and len(full_text) < 800:
            warnings.append(
                f"{images_total} embedded images detected with little extractable text; "
                "image-heavy resumes lose content in most ATS parsers."
            )

        result = ExtractedText(
            full_text=full_text,
            page_count=page_count,
            extraction_method=method,
            is_scanned=is_scanned,
            ocr_attempted=ocr_attempted,
            ocr_available=OCRSupport.is_available(),
            tables_detected=tables_total,
            images_detected=images_total,
            char_count=len(full_text),
            warnings=warnings,
        )
        logger.info(
            "pdf_extracted",
            extra={
                "file_name": filename,
                "pages": page_count,
                "chars": result.char_count,
                "method": method.value,
                "tables": tables_total,
                "ocr_pages": ocr_pages,
            },
        )
        return result

    def _extract_page_text(self, page: Any) -> str:
        """Extract text from one pdfplumber page, tolerating layout quirks."""
        try:
            text = page.extract_text(layout=False, x_density=7.25, y_density=13) or ""
        except Exception:  # pragma: no cover - fall back to default settings
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                logger.debug("page_text_failed", extra={"error": str(exc)})
                text = ""
        return text

    def _ocr_pages(
        self, file_bytes: bytes, page_numbers: List[int], warnings: List[str]
    ) -> Dict[int, str]:
        """Run OCR over specific 1-indexed pages. Returns ``{page: text}``."""
        results: Dict[int, str] = {}
        if not OCRSupport.is_available():
            OCRSupport.check()
            if OCRSupport.error and OCRSupport.error not in warnings:
                warnings.append(OCRSupport.error)
            return results

        pages = [p for p in page_numbers if 1 <= p <= settings.ocr_max_pages]
        skipped = [p for p in page_numbers if p not in pages]
        if skipped:
            warnings.append(
                f"OCR is capped at {settings.ocr_max_pages} pages; pages {skipped[:5]} were skipped."
            )
        if not pages:
            return results

        tmpdir = tempfile.mkdtemp(prefix="ats-ocr-")
        try:
            from pdf2image import convert_from_bytes
            import pytesseract

            pytesseract.pytesseract.tesseract_cmd = OCRSupport.tesseract_binary or "tesseract"
            images = convert_from_bytes(
                file_bytes,
                dpi=self.dpi,
                first_page=min(pages),
                last_page=max(pages),
                fmt="png",
                output_folder=tmpdir,
                thread_count=1,
            )
            offset = min(pages)
            for position, image in enumerate(images):
                page_number = offset + position
                if page_number not in pages:
                    continue
                try:
                    text = pytesseract.image_to_string(
                        image, lang=self.ocr_languages, config="--psm 3 --oem 3"
                    )
                    results[page_number] = collapse_whitespace(strip_control_chars(text or ""))
                except Exception as exc:  # noqa: BLE001
                    warnings.append(f"OCR failed on page {page_number}: {exc}")
        except Exception as exc:  # noqa: BLE001
            logger.warning("ocr_pipeline_failed", extra={"error": str(exc)})
            warnings.append(
                f"OCR could not be completed ({type(exc).__name__}). "
                "Text-based extraction results were used instead."
            )
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

        logger.info("ocr_completed", extra={"pages_ocr": len(results)})
        return results

    # ------------------------------------------------------------------ #
    # Plain text / DOCX
    # ------------------------------------------------------------------ #
    def _from_plain_text(self, file_bytes: bytes, filename: str) -> ExtractedText:
        text = self._decode(file_bytes)
        cleaned = collapse_whitespace(strip_control_chars(text))
        if not cleaned.strip():
            raise PDFExtractionError(
                f"The text file '{filename}' contains no readable characters.",
                context={"filename": filename},
            )
        return ExtractedText(
            full_text=cleaned,
            page_count=max(1, cleaned.count("\f") + 1),
            extraction_method=ExtractionMethod.PLAIN_TEXT,
            is_scanned=False,
            char_count=len(cleaned),
        )

    def _from_docx(self, file_bytes: bytes, filename: str) -> ExtractedText:
        """Read ``word/document.xml`` without requiring python-docx."""
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
                parts = [
                    "word/document.xml",
                    "word/header1.xml",
                    "word/footer1.xml",
                ]
                chunks: List[str] = []
                for part in parts:
                    if part in archive.namelist():
                        xml = archive.read(part).decode("utf-8", errors="ignore")
                        xml = _WORD_BREAK_RE.sub("\n", xml)
                        xml = _PARAGRAPH_RE.sub("\n", xml)
                        chunks.append(_XML_TAG_RE.sub(" ", xml))
                text = collapse_whitespace(strip_control_chars("\n".join(chunks)))
        except zipfile.BadZipFile as exc:
            raise PDFExtractionError(
                f"'{filename}' is not a valid .docx file.", detail=str(exc)
            ) from exc
        except Exception as exc:  # noqa: BLE001
            raise PDFExtractionError(
                f"Could not read the Word document '{filename}'.", detail=str(exc)
            ) from exc

        if not text.strip():
            raise PDFExtractionError(
                f"No text could be extracted from '{filename}'.", context={"filename": filename}
            )
        logger.info("docx_extracted", extra={"file_name": filename, "chars": len(text)})
        return ExtractedText(
            full_text=text,
            page_count=max(1, len(text) // 3000 + 1),
            extraction_method=ExtractionMethod.DOCX,
            is_scanned=False,
            char_count=len(text),
        )

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _looks_like_pdf(file_bytes: bytes) -> bool:
        return file_bytes[:5].startswith(b"%PDF-")

    @staticmethod
    def _decode(file_bytes: bytes) -> str:
        for encoding in ("utf-8", "cp1252", "latin-1"):
            try:
                return file_bytes.decode(encoding)
            except UnicodeDecodeError:
                continue
        return file_bytes.decode("utf-8", errors="replace")


#: Shared extractor instance.
pdf_extractor = PDFExtractor()

__all__ = ["PDFExtractor", "pdf_extractor", "OCRSupport"]
