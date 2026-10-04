"""Tests for stage 2 — :mod:`core.text_cleaner`.

These double as regression tests for the hardest bug found during development:
placeholder-based special-character stripping used to destroy every protected
token (``C++`` became ``3``, ``Node.js`` became ``7``), which silently corrupted
the entire downstream pipeline.
"""

from __future__ import annotations

import pytest

from core.text_cleaner import TextCleaner, text_cleaner
from models.schemas import CleanedText


@pytest.fixture
def cleaner() -> TextCleaner:
    return TextCleaner()


class TestClean:
    def test_returns_cleaned_text_model(self, cleaner: TextCleaner):
        result = cleaner.clean("Simple resume text with several sentences. Another one here.")
        assert isinstance(result, CleanedText)
        assert result.cleaned_text
        assert result.word_count > 0
        assert result.char_count == len(result.cleaned_text)

    def test_harvests_emails(self, cleaner: TextCleaner):
        result = cleaner.clean("Contact John Doe at john.doe@example.com for details.")
        assert "john.doe@example.com" in result.extracted_contacts.emails

    def test_harvests_phone_numbers(self, cleaner: TextCleaner):
        result = cleaner.clean("Call (415) 555-0134 or +1 415 555 0134 today.")
        phones = " ".join(result.extracted_contacts.phones)
        assert "415" in phones and "555" in phones

    def test_harvests_urls_and_bare_domains(self, cleaner: TextCleaner):
        result = cleaner.clean(
            "Portfolio: https://johndoe.dev/projects and github.com/johndoe and linkedin.com/in/johndoe"
        )
        urls = " ".join(result.extracted_contacts.urls).lower()
        assert "johndoe.dev" in urls
        assert "github.com/johndoe" in urls
        assert "linkedin.com/in/johndoe" in urls

    @pytest.mark.parametrize(
        "token", ["C++", "C#", "Node.js", "CI/CD", "M.S.", ".NET", "A/B testing", "scikit-learn"]
    )
    def test_preserves_compound_technical_tokens(self, cleaner: TextCleaner, token: str):
        """Regression: protected tokens must survive the special-character pass."""
        result = cleaner.clean(f"Experienced with {token} in production systems.")
        assert token.lower() in result.cleaned_text.lower(), (
            f"{token!r} was destroyed by cleaning: {result.cleaned_text!r}"
        )

    def test_compound_tokens_are_not_replaced_by_placeholder_indexes(self, cleaner: TextCleaner):
        """The old bug replaced each protected token with its list index digit."""
        text = "Skills: C++, Node.js, CI/CD, M.S., .NET"
        result = cleaner.clean(text)
        assert not any(str(i) == word for i, word in enumerate(result.cleaned_text.split()))

    def test_collapses_excess_whitespace(self, cleaner: TextCleaner):
        result = cleaner.clean("Too    much\n\n\n   whitespace    here")
        assert "    " not in result.cleaned_text
        assert "\n\n\n" not in result.cleaned_text

    def test_strips_control_characters(self, cleaner: TextCleaner):
        result = cleaner.clean("Resume\x00with\x07control\x1bchars")
        assert "\x00" not in result.cleaned_text
        assert "\x07" not in result.cleaned_text

    def test_segments_sentences(self, cleaner: TextCleaner):
        result = cleaner.clean(
            "Built ML models. Deployed them on AWS. Reduced latency by 40%."
        )
        assert len(result.sentences) >= 3

    def test_keeps_line_structure_for_section_parsing(self, cleaner: TextCleaner):
        result = cleaner.clean("EXPERIENCE\nSenior Engineer\nEDUCATION\nM.S. Stanford")
        assert len(result.lines) >= 4

    def test_is_idempotent(self, cleaner: TextCleaner):
        text = "John Doe\nSenior Engineer\nSkills: Python, C++, CI/CD\njohn@example.com"
        once = cleaner.clean(text).cleaned_text
        twice = cleaner.clean(once).cleaned_text
        assert once == twice

    def test_empty_input(self, cleaner: TextCleaner):
        result = cleaner.clean("")
        assert result.cleaned_text == ""
        assert result.word_count == 0
        assert result.sentences == []

    def test_ocr_mode_repairs_artifacts_without_losing_words(self, cleaner: TextCleaner):
        result = cleaner.clean("Pyth0n eng1neer w1th Docker", is_ocr_text=True)
        assert len(result.cleaned_text.split()) >= 4


class TestHelpers:
    @pytest.mark.parametrize(
        "line", ["EXPERIENCE", "WORK EXPERIENCE:", "EDUCATION", "SKILLS", "PROFESSIONAL SUMMARY"]
    )
    def test_detects_uppercase_header_lines(self, line: str):
        assert TextCleaner.looks_like_header_line(line) is True

    @pytest.mark.parametrize(
        "line",
        [
            "Work Experience",  # mixed case is body-ish for this heuristic
            "- Built machine learning models that reduced false positives by 34%.",
            "I led a team of four engineers across two continents for three years.",
            "",
        ],
    )
    def test_rejects_non_header_lines(self, line: str):
        assert TextCleaner.looks_like_header_line(line) is False

    def test_remove_noise_lines_drops_page_furniture(self):
        text = "Page 1 of 2\nJohn Doe\n  3 / 4  \nSenior Engineer"
        cleaned = TextCleaner.remove_noise_lines(text)
        assert "John Doe" in cleaned
        assert "Senior Engineer" in cleaned
        assert "Page 1 of 2" not in cleaned
        assert "3 / 4" not in cleaned

    def test_module_singleton_is_reusable(self):
        assert isinstance(text_cleaner, TextCleaner)
        assert text_cleaner.clean("Reusable singleton check.").cleaned_text
