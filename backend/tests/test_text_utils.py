"""Tests for :mod:`utils.text_utils` — the shared string helpers."""

from __future__ import annotations

import pytest

from utils.text_utils import (
    chunk_text,
    clamp,
    collapse_whitespace,
    dedupe_preserve_order,
    fix_ocr_artifacts,
    is_section_header_candidate,
    normalize_unicode,
    safe_ratio,
    strip_bullets,
    strip_control_chars,
    titleize,
    token_frequencies,
    truncate,
)


class TestNormalizeUnicode:
    def test_maps_typographic_characters_to_ascii(self):
        assert normalize_unicode("M.S. — Computer Science") == "M.S. - Computer Science"
        assert normalize_unicode("“quoted” and ‘single’") == '"quoted" and \'single\''

    def test_replaces_non_breaking_space_with_a_real_space(self):
        cleaned = normalize_unicode("Docker\u00a0and\u00a0Kubernetes")
        assert "\u00a0" not in cleaned
        assert cleaned == "Docker and Kubernetes"

    def test_removes_zero_width_characters(self):
        cleaned = normalize_unicode("Kub\u200bernetes\u200c\ufeff")
        assert "\u200b" not in cleaned and "\u200c" not in cleaned and "\ufeff" not in cleaned
        assert cleaned == "Kubernetes"

    def test_expands_ligatures(self):
        assert normalize_unicode("o\ufb03ce") == "office"

    def test_empty_and_none_input(self):
        assert normalize_unicode("") == ""
        assert normalize_unicode(None) == ""  # type: ignore[arg-type]


class TestCollapseWhitespace:
    def test_collapses_runs_of_spaces_and_tabs(self):
        assert collapse_whitespace("  a   b\t\tc  ") == "a b c"

    def test_keeps_single_newlines_so_line_structure_survives(self):
        assert collapse_whitespace("line one\nline two") == "line one\nline two"

    def test_collapses_blank_line_runs_to_at_most_two(self):
        assert "\n\n\n" not in collapse_whitespace("a\n\n\n\n\nb")

    def test_strips_each_line(self):
        assert collapse_whitespace("  a  \n  b  ") == "a\nb"


class TestStripControlChars:
    def test_removes_control_characters(self):
        assert strip_control_chars("a\x00b\x07c") == "abc"

    def test_keeps_newlines_and_tabs(self):
        assert strip_control_chars("a\nb\tc") == "a\nb\tc"


class TestFixOcrArtifacts:
    def test_repairs_digit_lookalikes_between_letters(self):
        assert fix_ocr_artifacts("Pyth0n") == "Python"
        assert fix_ocr_artifacts("sca1e") == "scale"
        assert fix_ocr_artifacts("data5et") == "dataset"

    def test_fixes_punctuation_spacing(self):
        assert fix_ocr_artifacts("skills :Python ,Docker") == "skills: Python, Docker"

    def test_is_idempotent(self):
        once = fix_ocr_artifacts("machine 1earning with Pyth0n")
        assert fix_ocr_artifacts(once) == once


class TestDedupePreserveOrder:
    def test_keeps_first_occurrence_order(self):
        assert dedupe_preserve_order(["b", "a", "b", "c", "a"]) == ["b", "a", "c"]

    def test_is_case_insensitive(self):
        assert dedupe_preserve_order(["Python", "python", "PYTHON"]) == ["Python"]

    def test_ignores_blank_entries_and_trims(self):
        assert dedupe_preserve_order(["", "   ", " x ", "x"]) == ["x"]

    def test_handles_any_iterable(self):
        assert dedupe_preserve_order(iter(["a", "b", "a"])) == ["a", "b"]


class TestTitleize:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("senior machine learning engineer", "Senior Machine Learning Engineer"),
            ("paediatric icu registered nurse", "Paediatric ICU Registered Nurse"),
            ("PAEDIATRIC ICU NURSE", "Paediatric ICU Nurse"),
            ("head of data science", "Head of Data Science"),
            ("aws solutions architect", "AWS Solutions Architect"),
            ("PyTorch engineer", "PyTorch Engineer"),
            ("data scientist (nlp/ml)", "Data Scientist (NLP/ML)"),
        ],
    )
    def test_titleize(self, raw: str, expected: str):
        assert titleize(raw) == expected

    def test_keeps_small_words_lowercase_mid_phrase(self):
        assert titleize("director of engineering and operations") == (
            "Director of Engineering and Operations"
        )

    def test_empty(self):
        assert titleize("") == ""


class TestChunkText:
    def test_short_text_is_one_chunk(self):
        assert chunk_text("short text", max_chars=500) == ["short text"]

    def test_empty_text(self):
        assert chunk_text("", max_chars=100) == []

    def test_chunks_without_overlap_cover_the_whole_document(self):
        text = ". ".join(f"Sentence number {i} of the document" for i in range(80))
        chunks = chunk_text(text, max_chars=200, overlap=0)
        assert len(chunks) > 1
        assert all(len(chunk) <= 260 for chunk in chunks)
        rejoined = " ".join(chunks)
        for probe in ("Sentence number 0 ", "Sentence number 79 "):
            assert probe.strip() in rejoined

    def test_overlap_repeats_boundary_content(self):
        text = ". ".join(f"chunkable sentence {i}" for i in range(60))
        overlapped = chunk_text(text, max_chars=200, overlap=80)
        plain = chunk_text(text, max_chars=200, overlap=0)
        assert sum(len(c) for c in overlapped) >= sum(len(c) for c in plain)


class TestTruncate:
    def test_returns_text_unchanged_when_short_enough(self):
        assert truncate("abcdef", 10) == "abcdef"

    def test_cuts_and_adds_ellipsis(self):
        result = truncate("abcdef", 4)
        assert result.endswith("\u2026")
        assert len(result) <= 4

    def test_collapses_internal_whitespace(self):
        assert truncate("a   b\n\nc", 50) == "a b c"

    def test_empty(self):
        assert truncate("", 5) == ""


class TestClamp:
    @pytest.mark.parametrize(
        "value,expected", [(-5, 0.0), (0, 0.0), (42, 42.0), (150, 100.0)]
    )
    def test_clamps_to_bounds(self, value: float, expected: float):
        assert clamp(value, 0.0, 100.0) == expected


class TestSafeRatio:
    def test_returns_default_on_zero_denominator(self):
        assert safe_ratio(10, 0) == 0.0
        assert safe_ratio(10, 0, default=1.0) == 1.0

    def test_computes_ratio(self):
        assert safe_ratio(3, 4) == 0.75


class TestMiscHelpers:
    def test_strip_bullets(self):
        assert strip_bullets("- Built ML models") == "Built ML models"
        assert strip_bullets("• Led a team") == "Led a team"
        assert strip_bullets("3. Shipped feature") == "Shipped feature"

    def test_is_section_header_candidate(self):
        assert is_section_header_candidate("WORK EXPERIENCE") is True
        assert is_section_header_candidate("SKILLS:") is True
        assert is_section_header_candidate(
            "- Built machine learning models that reduced false positives by 34%."
        ) is False

    def test_token_frequencies_is_case_insensitive(self):
        counts = token_frequencies(["Python", "python", "Docker", ""])
        assert counts["python"] == 2
        assert counts["docker"] == 1
        assert "" not in counts
