"""Stage 9 — resume section parsing.

Resumes are semi-structured documents: a heading line followed by its content.
This module detects those headings with a layered strategy so it works across
the many layouts ATS parsers encounter:

1. **Exact / alias match** against a curated header vocabulary (``WORK
   EXPERIENCE`` -> ``experience``), case- and punctuation-insensitive.
2. **Formatting cues** — all-caps short lines, trailing colons, and lines that
   are visually isolated — which raise the confidence of a match.
3. **Positional fallback** — the first block of the document is treated as
   contact/header material even when it has no heading.

Each detected section becomes a :class:`~models.schemas.SectionInfo` carrying
its text, size and detection confidence, which downstream stages use for
section-level scoring and for the "standard headers used" ATS check.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from models.schemas import SectionInfo
from utils.logger import get_logger
from utils.text_utils import collapse_whitespace, dedupe_preserve_order

logger = get_logger(__name__)

HEADER_NOISE_RE = re.compile(r"[\s\-_:|•·.\u2022]+$")
LEADING_NOISE_RE = re.compile(r"^[\s\-_:|•·.\u2022\d()\[\]]+")


#: Words that betray prose rather than a heading label. Used to guard the
#: loosest (word-subset) alias rule only — exact alias matches are unaffected.
_PROSE_WORDS = {
    "with", "in", "from", "the", "for", "to", "at", "on", "as", "is", "are",
    "was", "were", "graduated", "including", "related", "currently", "since",
    "during", "while", "our", "my", "we", "has", "have", "had", "and/or",
}

#: A line that opens with a year or a month is a date line, not a heading.
_DATE_LEAD_RE = re.compile(
    r"^[\(\[]?(?:19|20)\d{2}\b|^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b"
    r"|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s",
    re.IGNORECASE,
)


class SectionParser:
    """Split a resume (or job description) into named sections."""

    #: Canonical section -> heading aliases (matched case-insensitively).
    SECTION_HEADERS: Dict[str, List[str]] = {
        "contact": [
            "contact", "contact info", "contact information", "personal details",
            "personal information", "header", "details",
        ],
        "summary": [
            "summary", "professional summary", "executive summary", "career summary",
            "profile", "professional profile", "career profile", "objective",
            "career objective", "about", "about me", "introduction", "overview",
            "personal statement", "elevator pitch",
        ],
        "experience": [
            "experience", "work experience", "professional experience", "employment",
            "employment history", "work history", "career history", "relevant experience",
            "technical experience", "industry experience", "internships",
            "internship experience", "work placements", "professional background",
            "experience summary", "positions held",
        ],
        "education": [
            "education", "academic", "academics", "academic background",
            "academic qualifications", "qualifications", "educational qualifications",
            "educational background", "degrees", "degree", "education and qualifications",
            "education history", "academic credentials", "coursework",
            "relevant coursework", "education & certifications",
        ],
        "skills": [
            "skills", "technical skills", "technology skills", "technologies",
            "tech stack", "technology stack", "skill set", "skillset", "skills summary",
            "core competencies", "competencies", "key skills", "relevant skills",
            "professional skills", "hard skills", "tools", "tools and technologies",
            "tools & technologies", "technologies used", "programming languages",
            "languages and tools", "areas of expertise", "expertise",
        ],
        "projects": [
            "projects", "project work", "project experience", "personal projects",
            "academic projects", "key projects", "selected projects", "portfolio",
            "work samples", "case studies", "publications", "research projects",
            "side projects", "open source", "open source contributions",
        ],
        "certifications": [
            "certifications", "certification", "certificates", "certificate",
            "licenses", "licences", "license", "professional certifications",
            "credentials", "courses", "courses and certifications", "training",
            "training and certifications", "professional development", "awards and certifications",
        ],
        "awards": [
            "awards", "honors", "honours", "achievements", "accomplishments",
            "recognition", "awards and honors", "awards & achievements", "scholarships",
        ],
        "languages": [
            "languages", "language skills", "spoken languages", "foreign languages",
        ],
        "volunteering": [
            "volunteering", "volunteer", "volunteer experience", "community service",
            "extracurricular", "extracurricular activities", "activities",
            "affiliations", "memberships", "professional affiliations",
        ],
        "references": ["references", "referees", "recommendations"],
    }

    #: Reverse index: alias -> canonical section.
    def __init__(self, headers: Optional[Dict[str, List[str]]] = None) -> None:
        self.headers = headers or self.SECTION_HEADERS
        self._alias_index: Dict[str, str] = {}
        for section, aliases in self.headers.items():
            for alias in aliases:
                self._alias_index[self._normalize(alias)] = section
        self._sorted_aliases = sorted(self._alias_index, key=len, reverse=True)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def parse_sections(self, text: str, *, source: str = "resume") -> Dict[str, SectionInfo]:
        """Split ``text`` into ``{section_name: SectionInfo}``."""
        if not text or not text.strip():
            return {}

        lines = [line.rstrip() for line in text.split("\n")]
        boundaries: List[Tuple[int, str, str, float]] = []  # (line_idx, section, heading, conf)

        for idx, line in enumerate(lines):
            match = self._match_header(line)
            if match:
                section, confidence = match
                boundaries.append((idx, section, line.strip(), confidence))

        sections: Dict[str, SectionInfo] = {}

        # Content before the first recognised heading is contact/header material.
        if boundaries:
            preamble = lines[: boundaries[0][0]]
            preamble_text = collapse_whitespace("\n".join(preamble)).strip()
            if preamble_text:
                sections["contact"] = self._make_section(
                    "contact", "", preamble_text, confidence=0.5
                )
        else:
            whole = collapse_whitespace(text)
            return {"unstructured": self._make_section("unstructured", "", whole, 0.2)}

        # Slice the text between consecutive heading boundaries.
        for position, (line_idx, section, heading, confidence) in enumerate(boundaries):
            end = boundaries[position + 1][0] if position + 1 < len(boundaries) else len(lines)
            body_lines = [
                line.strip()
                for line in lines[line_idx + 1: end]
                if line.strip() and not self._is_header_repeat(line.strip(), heading)
            ]
            body = collapse_whitespace("\n".join(body_lines)).strip()
            existing = sections.get(section)
            candidate = self._make_section(section, heading, body, confidence)
            if existing is None:
                sections[section] = candidate
            else:
                # Duplicate heading (e.g. "SKILLS" listed twice): merge the bodies
                # instead of keeping whichever block happened to be longer.
                merged = collapse_whitespace(
                    "\n".join(part for part in (existing.text, body) if part)
                ).strip()
                sections[section] = self._make_section(
                    section,
                    existing.heading or heading,
                    merged,
                    max(existing.confidence, confidence),
                )

        # Anything left with no heading at all.
        if not sections or all(not s.text.strip() for s in sections.values()):
            sections["unstructured"] = self._make_section(
                "unstructured", "", collapse_whitespace(text), 0.2
            )

        logger.info(
            "sections_parsed",
            extra={
                "source": source,
                "sections": list(sections.keys()),
                "headings_found": len(boundaries),
            },
        )
        return sections

    def detected_section_names(self, sections: Dict[str, SectionInfo]) -> List[str]:
        """Names of sections that actually contain text."""
        return [
            name for name, info in sections.items()
            if info.text.strip() and name not in {"unstructured", "references"}
        ]

    def missing_standard_sections(self, sections: Dict[str, SectionInfo]) -> List[str]:
        """Standard resume sections that were not found (drives recommendations)."""
        expected = ["summary", "experience", "education", "skills"]
        return [name for name in expected if name not in sections or not sections[name].text.strip()]

    def get_section_text(self, sections: Dict[str, SectionInfo], name: str) -> str:
        """Safe accessor returning ``""`` for absent sections."""
        info = sections.get(name)
        return info.text if info else ""

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _match_header(self, line: str) -> Optional[Tuple[str, float]]:
        """Return ``(section, confidence)`` when a line looks like a heading."""
        raw = line.strip()
        if not raw or len(raw) > 70:
            return None
        if raw.count("\n") or raw.count("  ") > 3:
            return None
        # Dates and bullets are body content, never headings.
        if _DATE_LEAD_RE.match(raw) or raw[0] in "-*•·–—":
            return None
        if len(raw.split()) > 7:
            return None

        normalized = self._normalize(raw)
        if not normalized:
            return None

        # 1. Exact alias match ------------------------------------------- #
        if normalized in self._alias_index:
            return self._alias_index[normalized], self._format_confidence(raw, 0.95)

        # 2. Alias with a small amount of decoration ---------------------- #
        #    e.g. "technical skills & tools", "education / certifications"
        stripped = re.sub(r"[^a-z0-9\s]", " ", normalized)
        stripped = collapse_whitespace(stripped)
        if stripped in self._alias_index:
            return self._alias_index[stripped], self._format_confidence(raw, 0.9)

        # The subset rule is the loosest one, so it is guarded hardest: content
        # lines such as "2012 - 2016 Graduated with honours" or "Graduated with
        # honours" must not be mistaken for an AWARDS heading and split the
        # EDUCATION section in two.
        words = set(stripped.split())
        has_digit = bool(re.search(r"\d", raw))
        has_prose_word = bool(words & _PROSE_WORDS)
        if not has_digit and not has_prose_word:
            for alias in self._sorted_aliases:
                alias_words = set(alias.split())
                if (
                    len(alias_words) <= len(words)
                    and alias_words.issubset(words)
                    and len(words) <= len(alias_words) + 3
                ):
                    return self._alias_index[alias], self._format_confidence(raw, 0.75)

        # 3. Heading-shaped line ending in a colon ------------------------ #
        if raw.endswith(":") and len(words) <= 5:
            key = stripped.rstrip(":")
            if key in self._alias_index:
                return self._alias_index[key], self._format_confidence(raw, 0.85)

        return None

    @staticmethod
    def _normalize(line: str) -> str:
        cleaned = LEADING_NOISE_RE.sub("", line.strip().lower())
        cleaned = HEADER_NOISE_RE.sub("", cleaned)
        cleaned = re.sub(r"\s*[|/•·]\s*", " ", cleaned)
        return collapse_whitespace(cleaned).strip()

    @staticmethod
    def _format_confidence(raw: str, base: float) -> float:
        """Boost confidence when the line is formatted like a heading."""
        letters = [c for c in raw if c.isalpha()]
        if not letters:
            return base
        if sum(1 for c in letters if c.isupper()) / len(letters) >= 0.8:
            base = min(1.0, base + 0.05)
        if raw.endswith(":"):
            base = min(1.0, base + 0.02)
        if len(raw.split()) <= 5:
            base = min(1.0, base + 0.02)
        return round(base, 2)

    @staticmethod
    def _is_header_repeat(line: str, heading: str) -> bool:
        return bool(heading) and line.strip().lower().rstrip(":") == heading.strip().lower().rstrip(":")

    @staticmethod
    def _make_section(name: str, heading: str, text: str, confidence: float) -> SectionInfo:
        words = text.split()
        return SectionInfo(
            name=name,
            heading=heading.strip(),
            text=text,
            line_count=text.count("\n") + (1 if text else 0),
            word_count=len(words),
            confidence=confidence,
            present=bool(text.strip()),
        )

    # ------------------------------------------------------------------ #
    def section_keywords(self, sections: Dict[str, SectionInfo]) -> List[str]:
        """Headings found in the document (used by the ATS formatting check)."""
        return dedupe_preserve_order(
            info.heading for info in sections.values() if info.heading
        )


#: Shared parser instance.
section_parser = SectionParser()

__all__ = ["SectionParser", "section_parser"]
