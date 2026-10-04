"""Stage 2 — text cleaning and normalisation.

Transforms raw extracted text into analysis-ready text while *preserving* the
information a resume matcher actually needs:

* unicode normalisation + typographic-character mapping (PDF ligatures, smart
  quotes, non-breaking spaces)
* emails / URLs / phone numbers are lifted out into
  :class:`~models.schemas.ExtractedContacts` instead of being thrown away —
  they feed the ATS "contact info is extractable" check
* special characters are stripped, but hyphens inside compound technical terms
  (``full-stack``, ``C++``, ``Node.js``, ``CI/CD``) are preserved
* whitespace normalisation, OCR artefact repair, sentence + line segmentation
"""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

from config import settings
from models.schemas import CleanedText, ExtractedContacts
from utils.logger import get_logger
from utils.text_utils import (
    collapse_whitespace,
    dedupe_preserve_order,
    fix_ocr_artifacts,
    normalize_unicode,
    strip_control_chars,
)

logger = get_logger(__name__)

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
URL_RE = re.compile(
    r"(?i)\b(?:https?://|www\.)[a-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+"
)
# Bare domains used on resumes for portfolios/profiles (no scheme, no "www").
BARE_DOMAIN_RE = re.compile(
    r"""(?i)\b(?:
        (?:linkedin|github|gitlab|bitbucket|kaggle|medium|behance|dribbble|
         stackoverflow|dev)\.(?:com|org|net|io|to)\b
        |[a-z0-9][\w\-]{1,40}\.(?:com|io|dev|me|ai|xyz|tech|org|net|co|dev)\b
       )(?:/[\w\-./?%&=+#~]*)?""",
    re.VERBOSE,
)
PHONE_RE = re.compile(
    r"(?:(?<=\D)|^)(?:\+?\d{1,3}[\s.\-()]?)?(?:\(?\d{2,4}\)?[\s.\-]?)\d{3,4}[\s.\-]?\d{3,4}(?=\D|$)"
)
# Keep hyphens/plus/dot/slash inside compound technical tokens.
COMPOUND_RE = re.compile(r"\b[A-Za-z0-9]+(?:[+#./\-][A-Za-z0-9]+)+\b")
SPECIAL_CHARS_RE = re.compile(r"[^\w\s.,;:!?'\"()\[\]/&+@#%\-—–\n]")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
CONTROL_LINE_RE = re.compile(r"^[\s\W_]*$", re.UNICODE)

# OCR mis-reads that appear when a scanned resume is read back.
_OCR_LINE_FIXES: Tuple[Tuple[str, str], ...] = (
    (r"\|\s*", " "),
    (r"\s{2,}\|", " "),
    (r"[‘’′`]", "'"),
    (r"[“”″]", '"'),
    (r"–|—", "-"),
    (r"\b0O\b", "OO"),
    (r"(?<=\w)\.(?=\w{2,})", "."),
)


class TextCleaner:
    """Normalise raw document text into analysis-ready text."""

    def __init__(self, extract_contacts: bool = True, repair_ocr: bool = True) -> None:
        self.extract_contacts = extract_contacts
        self.repair_ocr = repair_ocr

    # ------------------------------------------------------------------ #
    def clean(self, raw_text: str, *, is_ocr_text: bool = False) -> CleanedText:
        """Run the full cleaning pipeline over ``raw_text``."""
        if not raw_text or not raw_text.strip():
            return CleanedText()

        text = normalize_unicode(strip_control_chars(raw_text))
        if is_ocr_text or self.repair_ocr:
            text = self._repair(text)

        contacts = ExtractedContacts()
        if self.extract_contacts:
            text, contacts = self._harvest_contacts(text)

        text = self._strip_special_chars(text)
        text = MULTI_SPACE_RE.sub(" ", text)
        text = collapse_whitespace(text)

        sentences = self._segment_sentences(text)
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        word_count = len(text.split())

        result = CleanedText(
            cleaned_text=text,
            extracted_contacts=contacts,
            sentences=sentences,
            lines=lines,
            word_count=word_count,
            char_count=len(text),
        )
        logger.debug(
            "text_cleaned",
            extra={
                "chars_in": len(raw_text),
                "chars_out": result.char_count,
                "sentences": len(sentences),
                "emails": len(contacts.emails),
                "phones": len(contacts.phones),
                "urls": len(contacts.urls),
            },
        )
        return result

    # ------------------------------------------------------------------ #
    def _repair(self, text: str) -> str:
        for pattern, replacement in _OCR_LINE_FIXES:
            text = re.sub(pattern, replacement, text)
        return fix_ocr_artifacts(text)

    def _harvest_contacts(self, text: str) -> Tuple[str, ExtractedContacts]:
        """Extract emails/URLs/phones, keeping placeholders in the text flow."""
        emails: List[str] = []
        urls: List[str] = []
        phones: List[str] = []

        def _replace_email(match: re.Match[str]) -> str:
            value = match.group(0).strip().rstrip(".,;:")
            emails.append(value.lower())
            return " "

        def _replace_url(match: re.Match[str]) -> str:
            value = match.group(0).strip().rstrip(".,;:)")
            urls.append(value.lower())
            return " "

        # Emails must be harvested before URLs/bare domains: otherwise the
        # domain part of ``name@example.com`` is captured as a bare domain and
        # the address itself is never recognised.
        text = EMAIL_RE.sub(_replace_email, text)
        text = URL_RE.sub(_replace_url, text)
        text = BARE_DOMAIN_RE.sub(_replace_url, text)

        # Phone detection runs after URLs/emails so their digits are gone.
        def _replace_phone(match: re.Match[str]) -> str:
            value = re.sub(r"\s+", " ", match.group(0)).strip()
            digits = re.sub(r"\D", "", value)
            if 7 <= len(digits) <= 15:
                phones.append(value)
            return " "

        text = PHONE_RE.sub(_replace_phone, text)

        contacts = ExtractedContacts(
            emails=dedupe_preserve_order(emails),
            urls=dedupe_preserve_order(urls),
            phones=dedupe_preserve_order(phones),
        )
        return text, contacts

    def _strip_special_chars(self, text: str) -> str:
        """Remove noise characters while protecting compound technical tokens.

        Compound tokens (``C++``, ``Node.js``, ``CI/CD``, ``M.S.``, ``full-stack``)
        are copied through verbatim; every other character outside the allowed
        set is replaced by a space.
        """
        out: List[str] = []
        cursor = 0
        for match in COMPOUND_RE.finditer(text):
            start, end = match.span()
            out.append(SPECIAL_CHARS_RE.sub(" ", text[cursor:start]))
            out.append(text[start:end])
            cursor = end
        out.append(SPECIAL_CHARS_RE.sub(" ", text[cursor:]))
        return "".join(out)

    def _segment_sentences(self, text: str) -> List[str]:
        """Split into sentences using punctuation + newline heuristics."""
        candidate_blocks: List[str] = []
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            candidate_blocks.append(line)

        sentences: List[str] = []
        for block in candidate_blocks:
            parts = [p.strip() for p in SENTENCE_SPLIT_RE.split(block) if p.strip()]
            sentences.extend(parts if parts else [block])
        return sentences

    # ------------------------------------------------------------------ #
    @staticmethod
    def looks_like_header_line(line: str) -> bool:
        """True for short, mostly-uppercase lines (typical section headers)."""
        stripped = line.strip().rstrip(":")
        if not stripped or len(stripped) > 60 or "\n" in stripped:
            return False
        letters = [c for c in stripped if c.isalpha()]
        if len(letters) < 3:
            return False
        upper = sum(1 for c in letters if c.isupper())
        return upper / len(letters) >= 0.8

    @staticmethod
    def remove_noise_lines(text: str) -> str:
        """Drop repeated page furniture (page numbers, 'Page 1 of 2', headers)."""
        kept: List[str] = []
        for line in text.split("\n"):
            if CONTROL_LINE_RE.match(line):
                continue
            if re.fullmatch(r"\s*page\s*\d+(\s*of\s*\d+)?\s*", line, flags=re.IGNORECASE):
                continue
            if re.fullmatch(r"\s*\d{1,3}\s*/\s*\d{1,3}\s*", line):
                continue
            kept.append(line)
        return "\n".join(kept)


#: Shared cleaner instance.
text_cleaner = TextCleaner()

__all__ = ["TextCleaner", "text_cleaner"]
