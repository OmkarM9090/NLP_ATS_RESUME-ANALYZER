"""Tests for stage 8 — resume section parsing."""

from __future__ import annotations

import pytest

from core.section_parser import SectionParser
from models.schemas import SectionInfo

CANONICAL = {
    "contact", "summary", "experience", "education", "skills", "projects",
    "certifications", "awards", "languages", "volunteering", "references",
    "unstructured",
}


@pytest.fixture
def parser() -> SectionParser:
    return SectionParser()


class TestParseSections:
    def test_detects_all_sections_of_the_sample_resume(self, parser, cleaned_resume):
        sections = parser.parse_sections(cleaned_resume, source="resume")
        assert set(sections) <= CANONICAL
        for expected in ("experience", "education", "skills", "summary"):
            assert expected in sections, f"missing {expected}: {sorted(sections)}"
            assert sections[expected].present

    def test_section_bodies_contain_their_own_content(self, parser, cleaned_resume):
        sections = parser.parse_sections(cleaned_resume, source="resume")
        assert "Stanford" in sections["education"].text
        assert "TensorFlow" in sections["skills"].text or "Python" in sections["skills"].text
        assert "DataScale" in sections["experience"].text

    def test_education_keeps_its_last_line(self, parser, cleaned_resume):
        """Regression: "2012 - 2016 Graduated with honours" was parsed as an
        AWARDS heading (alias "honours"), truncating the education section."""
        sections = parser.parse_sections(cleaned_resume, source="resume")
        assert "honours" in sections["education"].text.lower()
        assert "2012" in sections["education"].text

    def test_returns_section_info_models(self, parser, cleaned_resume):
        sections = parser.parse_sections(cleaned_resume)
        for info in sections.values():
            assert isinstance(info, SectionInfo)
            assert info.word_count == len(info.text.split())
            assert 0.0 <= info.confidence <= 1.0

    def test_exact_alias_gets_high_confidence(self, parser):
        sections = parser.parse_sections("SKILLS\nPython, SQL, Docker")
        assert sections["skills"].confidence >= 0.9

    def test_recognises_common_aliases(self, parser):
        text = (
            "PROFESSIONAL SUMMARY\nAn engineer.\n"
            "EMPLOYMENT HISTORY\nBuilt systems.\n"
            "TECHNICAL SKILLS & TOOLS\nPython.\n"
            "ACADEMIC BACKGROUND\nM.S. Stanford."
        )
        sections = parser.parse_sections(text)
        assert "summary" in sections
        assert "experience" in sections
        assert "skills" in sections
        assert "education" in sections

    def test_preamble_becomes_contact_section(self, parser):
        text = "John Doe\nSan Francisco, CA\njohn@example.com\n\nEXPERIENCE\nBuilt things."
        sections = parser.parse_sections(text)
        assert "contact" in sections
        assert "John Doe" in sections["contact"].text
        assert sections["contact"].confidence < sections["experience"].confidence

    def test_no_headings_falls_back_to_unstructured(self, parser):
        text = "Just a wall of text with no headings at all, only prose about work."
        sections = parser.parse_sections(text)
        assert list(sections) == ["unstructured"]
        assert sections["unstructured"].confidence <= 0.2

    def test_duplicate_headings_are_merged(self, parser):
        text = "SKILLS\nPython\n\nEXPERIENCE\nBuilt things.\n\nSKILLS\nDocker"
        sections = parser.parse_sections(text)
        assert "Python" in sections["skills"].text
        assert "Docker" in sections["skills"].text

    def test_empty_text(self, parser):
        assert parser.parse_sections("") == {}
        assert parser.parse_sections("   \n  ") == {}

    @pytest.mark.parametrize(
        "line",
        [
            "2012 - 2016 Graduated with honours",
            "- Led a team of engineers",
            "Built machine learning models that reduced false positives by 34%",
            "2021 - Present",
        ],
    )
    def test_content_lines_are_not_headings(self, parser, line):
        """Regression: date/prose lines used to split sections."""
        sections = parser.parse_sections(f"EDUCATION\nM.S. Stanford\n{line}\nSKILLS\nPython")
        assert line.strip().split("\n")[0] in sections["education"].text or not sections[
            "education"
        ].text
        assert "awards" not in sections

    def test_job_description_sections_are_parsed_too(self, parser, cleaned_jd):
        sections = parser.parse_sections(cleaned_jd, source="job_description")
        assert sections, "a JD should yield at least one section"


class TestHelpers:
    def test_detected_section_names(self, parser, cleaned_resume):
        sections = parser.parse_sections(cleaned_resume)
        names = parser.detected_section_names(sections)
        assert "skills" in names
        assert all(name in CANONICAL for name in names)

    def test_missing_standard_sections(self, parser):
        sections = parser.parse_sections("SKILLS\nPython")
        missing = parser.missing_standard_sections(sections)
        assert "experience" in missing
        assert "skills" not in missing

    def test_get_section_text(self, parser, cleaned_resume):
        sections = parser.parse_sections(cleaned_resume)
        assert parser.get_section_text(sections, "education")
        assert parser.get_section_text(sections, "nonexistent") == ""

    def test_section_keywords(self, parser, cleaned_resume):
        sections = parser.parse_sections(cleaned_resume)
        keywords = parser.section_keywords(sections)
        assert isinstance(keywords, list)
