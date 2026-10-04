"""Stage 7 — entity extraction (skills, education, experience, contacts).

Two complementary sources of entities:

* **spaCy NER** — statistical ``PERSON``/``ORG``/``GPE``/``DATE``/``MONEY`` when
  ``en_core_web_lg`` is installed, plus taxonomy/gazetteer entities from the
  ``EntityRuler`` in both modes.
* **Deterministic extractors** — regex + gazetteer matching for the fields an
  ATS actually cares about: degrees, certifications, date ranges, years of
  experience, salary, required-vs-preferred skills, job title and location.

The deterministic layer guarantees structured output even when no statistical
model is available, and it is what powers ``required_skills`` vs
``preferred_skills`` separation in job descriptions.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from core.nlp_pipeline import NLPPipeline
from models.schemas import CleanedText, JobDescriptionEntities, ResumeEntities, SectionInfo
from services.cache_service import load_json
from config import settings
from utils.logger import get_logger
from utils.text_utils import dedupe_preserve_order, strip_bullets, titleize

logger = get_logger(__name__)

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

_MONTH_ALT = "|".join(MONTHS)

DATE_RANGE_RE = re.compile(
    rf"""
    (?P<start_month>(?:{_MONTH_ALT})\.?)?\s*(?P<start_year>(?:19|20)\d{{2}})
    \s*(?:-|–|—|to|until|through)\s*
    (?:(?P<end_month>(?:{_MONTH_ALT})\.?)?\s*(?P<end_year>(?:19|20)\d{{2}})
      |(?P<open>present|current|now|ongoing|till\s+date|to\s+date))
    """,
    re.IGNORECASE | re.VERBOSE,
)
MONTH_YEAR_RE = re.compile(rf"(?P<month>{_MONTH_ALT})\.?,?\s*(?P<year>(?:19|20)\d{{2}})", re.IGNORECASE)
YEAR_ONLY_RE = re.compile(r"\b((?:19|20)\d{2})\b")

EXPLICIT_YEARS_RE = re.compile(
    r"(?P<years>\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b(?:\s+of)?",
    re.IGNORECASE,
)
JD_YEARS_RE = re.compile(
    r"""(?:(?:minimum|min|at\s+least|over|more\s+than|around|about|approx\.?)\s*)?
        (?P<low>\d{1,2})\s*(?:\+|\s*(?:-|–|to)\s*(?P<high>\d{1,2}))?\s*
        \s*(?:years?|yrs?)""",
    re.IGNORECASE | re.VERBOSE,
)
SALARY_RE = re.compile(
    r"""(?:\$|£|€|₹|usd|gbp|eur|inr)\s?\d[\d,]*(?:\.\d+)?\s*(?:k|m| thousand| million)?
        (?:\s*(?:-|–|to)\s*(?:\$|£|€|₹|usd|gbp|eur|inr)?\s?\d[\d,]*(?:\.\d+)?\s*(?:k|m| thousand| million)?)?
        (?:\s*(?:per|/|an?\s+)(?:year|annum|hour|hr|yr))?""",
    re.IGNORECASE | re.VERBOSE,
)
EDUCATION_LEVEL_ORDER = ["high_school", "certification", "associate", "bachelor", "master", "phd"]

_JOB_TITLE_LINE_RE = re.compile(
    r"^\s*(?:job\s*title|position|role|title|hiring\s+for|we\s+are\s+hiring)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_LOCATION_LINE_RE = re.compile(
    r"^\s*(?:location|work\s+location|based\s+in|place|office)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
WORDISH_RE = re.compile(r"[a-z][a-z0-9+#.\-/&]*", re.IGNORECASE)

#: Generic degree words that must not be reported as a concrete degree.
#: Degree-related wording used to tell an academic date range ("2012 - 2016 |
#: Graduated with honours") apart from an employment one. Deliberately avoids
#: bare "master"/"university", which also appear in job titles and employers
#: ("Scrum Master", "University of Michigan").
_DEGREE_CONTEXT_RE = re.compile(
    r"(?:\b(?:b\.?\s?s\.?c?\.?|m\.?\s?s\.?c?\.?|b\.?\s?a\.?|m\.?\s?a\.?)\b"
    r"|\bb\.?tech\b|\bm\.?tech\b|\bm\.?b\.?a\b|\bmba\b|\bph\.?\s?d\.?\b"
    r"|\bbachelor\w*\b|\bmaster(?:'s|s)?\s+(?:degree|of|sc|science|arts)\b"
    r"|\bdoctorat\w*\b|\bdoctor\s+of\b|\bassociate\s+degree\b|\bdiploma\b"
    r"|\bgpa\b|\bhonou?rs\b|\bgraduat\w*\b|\bcoursework\b|\bundergraduate\b"
    r"|\bpost-?graduate\b|\bspeciali[sz]ation\s+in\b|\bclass\s+of\s+\d{4}\b"
    r"|\b(?:conferred|awarded)\b)",
    re.IGNORECASE,
)


_GENERIC_DEGREE_SURFACES = {
    "certification", "certifications", "certificate", "certificates", "certified",
    "accreditation", "license", "licenses", "licences", "professional certification",
    "degree", "degrees", "diploma", "graduate degree", "qualification",
    "qualifications", "undergraduate", "postgraduate", "post-graduate",
    "higher national diploma", "hnd", "hnc", "professional degree",
    # Academic decorations and study details that are not degrees themselves.
    "honours", "honors", "honour", "honor", "with honours", "with honors",
    "graduated", "graduated with honours", "graduated with honors", "graduation",
    "cum laude", "magna cum laude", "summa cum laude", "gpa", "major", "minor",
    "concentration", "specialisation", "specialization", "coursework", "thesis",
    "relevant coursework", "student", "candidate",
}

_SUFFIXES_FOR_STEMMING = ("ing", "ed", "es", "s", "ment", "tion", "ation", "er", "or")


#: Taxonomy aliases that are also ordinary English words. Matched
#: case-insensitively they generate false positives ("building the *next*
#: generation" -> Next.js, "a *go* to tool" -> Go), so they are either dropped
#: or only matched with the technology's own capitalisation.
_AMBIGUOUS_SKILL_SURFACES_DROP = {
    "next",      # Next.js is covered by "next.js", "nextjs", "next js"
    "safe",      # SAFe is covered by "agile", "scrum"
    "lean",      # "lean manufacturing" / "lean towards"
    "sketch",    # "sketch out an idea"
    "elastic",   # "elastic infrastructure"; Elasticsearch covers the product
    "canvas",    # "canvas" element vs. Canvas LMS
    "spring",    # "spring 2024" vs. Spring Framework (covered by "spring boot")
    "express",   # "express interest" vs. Express.js (covered by "express.js")
    "flask",     # rare but "flask" as a container noun
    "sails", "rails",  # "ruby on rails" covers the framework
}
_AMBIGUOUS_SKILL_SURFACES_CASE_SENSITIVE = {
    "go", "rust", "swift", "spark", "kotlin", "dart", "groovy", "falcon",
    "tableau", "looker", "redis", "kafka", "airflow", "docker", "jira",
}


def skill_surface_policy(surface: str) -> str:
    """Return how a taxonomy alias may be matched: ``drop`` / ``exact`` / ``any``.

    Shared by the regex matcher here and by spaCy's ``EntityRuler`` patterns in
    :mod:`services.cache_service` so both agree on ambiguous terms.
    """
    lowered = (surface or "").strip().lower()
    if not lowered:
        return "drop"
    if lowered in _AMBIGUOUS_SKILL_SURFACES_DROP:
        return "drop"
    if lowered in _AMBIGUOUS_SKILL_SURFACES_CASE_SENSITIVE:
        return "exact"
    return "any"


def _stem(word: str) -> str:
    """Very light suffix stemmer used for soft-skill/alias matching."""
    lowered = word.strip().lower()
    if len(lowered) <= 4:
        return lowered
    for suffix in _SUFFIXES_FOR_STEMMING:
        if lowered.endswith(suffix) and len(lowered) - len(suffix) >= 4:
            return lowered[: -len(suffix)]
    return lowered


#: Display forms for common degree abbreviations (title-casing mangles them).
_DEGREE_DISPLAY = {
    "m.s.": "M.S.", "ms": "M.S.", "b.s.": "B.S.", "bs": "B.S.",
    "m.sc": "M.Sc.", "msc": "M.Sc.", "b.sc": "B.Sc.", "bsc": "B.Sc.",
    "m.a.": "M.A.", "ma": "M.A.", "b.a.": "B.A.", "ba": "B.A.",
    "phd": "PhD", "ph.d": "Ph.D.", "ph.d.": "Ph.D.", "md": "MD", "jd": "JD",
    "mba": "MBA", "m.b.a": "MBA", "m.eng": "M.Eng", "meng": "M.Eng",
    "b.eng": "B.Eng", "beng": "B.Eng", "m.tech": "M.Tech", "mtech": "M.Tech",
    "b.tech": "B.Tech", "btech": "B.Tech", "mca": "MCA", "bca": "BCA",
    "mphil": "MPhil", "m.phil": "M.Phil", "ed d": "EdD", "edd": "EdD",
    "a.s.": "A.S.", "a.a.": "A.A.", "hnd": "HND", "hnc": "HNC",
    "bsn": "BSN", "bba": "BBA", "bcom": "B.Com", "bfa": "BFA", "mfa": "MFA",
    "mph": "MPH", "llm": "LLM", "msw": "MSW", "dba": "DBA",
}


def _prettify_degree(degree: str) -> str:
    """Render a degree string with conventional capitalisation."""
    text = (degree or "").strip()
    if not text:
        return text
    small_words = {"in", "of", "and", "the", "from", "with", "a", "an"}
    tokens = text.split()
    out: List[str] = []
    for position, token in enumerate(tokens):
        bare = token.strip(",").lower()
        candidates = {bare, bare.rstrip("."), f"{bare.rstrip('.')}.", bare.replace(".", "")}
        display = next((v for c in candidates if (v := _DEGREE_DISPLAY.get(c))), None)
        if display:
            out.append(display)
            continue
        letters = [c for c in token if c.isalpha()]
        if len(letters) >= 2 and all(c.isupper() for c in letters):
            out.append(token)  # keep acronyms uppercase
        elif token.lower() in small_words and position > 0:
            out.append(token.lower())
        else:
            out.append(titleize(token))
    return " ".join(out)


class EntityExtractor:
    """Extract structured entities from resumes and job descriptions."""

    def __init__(
        self,
        nlp_pipeline: Optional[NLPPipeline] = None,
        taxonomy: Optional[Dict[str, Any]] = None,
        gazetteers: Optional[Dict[str, Any]] = None,
        industry: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.pipeline = nlp_pipeline
        self.taxonomy = taxonomy if taxonomy is not None else load_json(settings.skill_taxonomy_path, {})
        self.gazetteers = gazetteers if gazetteers is not None else load_json(
            settings.data_dir / "gazetteers.json", {}
        )
        self.industry = industry if industry is not None else load_json(
            settings.industry_keywords_path, {}
        )
        self._skill_patterns: List[Tuple[re.Pattern[str], str, str]] = []
        self._degree_patterns: List[Tuple[re.Pattern[str], str, str]] = []
        self._cert_patterns: List[Tuple[re.Pattern[str], str]] = []
        self._title_patterns: List[Tuple[re.Pattern[str], str]] = []
        self._location_patterns: List[Tuple[re.Pattern[str], str]] = []
        self._org_patterns: List[Tuple[re.Pattern[str], str]] = []
        self._compile_patterns()

    # ------------------------------------------------------------------ #
    # Pattern compilation
    # ------------------------------------------------------------------ #
    def _compile_patterns(self) -> None:
        """Compile taxonomy + gazetteer entries into boundary-aware regexes."""
        skills: List[Tuple[int, str, str, str, bool]] = []
        for category, entries in self.taxonomy.items():
            if category.startswith("_") or not isinstance(entries, dict):
                continue
            for canonical, aliases in entries.items():
                canonical = str(canonical).strip()
                surfaces = {canonical.lower()}
                if isinstance(aliases, list):
                    surfaces.update(str(a).strip().lower() for a in aliases if a and str(a).strip())
                for surface in surfaces:
                    if len(surface) < 2 or (len(surface) <= 2 and not surface.isalpha()):
                        continue
                    policy = skill_surface_policy(surface)
                    if policy == "drop":
                        continue  # ambiguous English word — see skill_surface_policy
                    skills.append((len(surface), surface, canonical, category, policy == "exact"))
        # Longest surface first so "machine learning" wins over "learning".
        skills.sort(key=lambda item: -item[0])
        seen: Set[str] = set()
        for _length, surface, canonical, category, case_sensitive in skills:
            key = surface
            if key in seen:
                continue
            seen.add(key)
            pattern = self._boundary_regex(surface, case_sensitive=case_sensitive)
            if pattern:
                self._skill_patterns.append((pattern, canonical, category))

        education_levels = self.industry.get("education_levels", {})
        for level, surfaces in education_levels.items():
            for surface in surfaces:
                pattern = self._boundary_regex(str(surface))
                if pattern:
                    self._degree_patterns.append((pattern, str(level), str(surface)))

        for surface in self.gazetteers.get("certifications", []):
            pattern = self._boundary_regex(str(surface), separator_tolerant=True)
            if pattern:
                self._cert_patterns.append((pattern, str(surface)))
        for surface in self.gazetteers.get("degrees", []):
            pattern = self._boundary_regex(str(surface))
            if pattern:
                self._degree_patterns.append((pattern, self._guess_degree_level(str(surface)), str(surface)))

        for surface in self.gazetteers.get("job_titles", []):
            pattern = self._boundary_regex(str(surface))
            if pattern:
                self._title_patterns.append((pattern, str(surface)))
        for surface in self.gazetteers.get("locations", []):
            pattern = self._boundary_regex(str(surface))
            if pattern:
                self._location_patterns.append((pattern, str(surface)))
        for surface in self.gazetteers.get("organizations", []):
            pattern = self._boundary_regex(str(surface))
            if pattern:
                self._org_patterns.append((pattern, str(surface)))
        for surface in self.gazetteers.get("universities", []):
            pattern = self._boundary_regex(str(surface))
            if pattern:
                self._org_patterns.append((pattern, str(surface)))

        self._skill_patterns.sort(key=lambda item: -len(item[0].pattern))
        self._cert_patterns.sort(key=lambda item: -len(item[0].pattern))
        self._title_patterns.sort(key=lambda item: -len(item[0].pattern))
        self._location_patterns.sort(key=lambda item: -len(item[0].pattern))
        self._org_patterns.sort(key=lambda item: -len(item[0].pattern))

        logger.info(
            "entity_patterns_compiled",
            extra={
                "skills": len(self._skill_patterns),
                "degrees": len(self._degree_patterns),
                "certifications": len(self._cert_patterns),
                "job_titles": len(self._title_patterns),
                "locations": len(self._location_patterns),
                "organizations": len(self._org_patterns),
            },
        )

    @staticmethod
    def _boundary_regex(
        surface: str,
        case_sensitive: bool = False,
        separator_tolerant: bool = False,
    ) -> Optional[re.Pattern[str]]:
        """Build a regex that matches ``surface`` on token boundaries.

        Handles symbols (``C++``, ``C#``, ``.NET``, ``CI/CD``) by only applying
        word boundaries where the surface actually starts/ends with a word char.
        """
        surface = surface.strip()
        if not surface:
            return None
        escaped = re.escape(surface)
        prefix = r"(?<![\w])" if surface[0].isalnum() else r"(?<![\w])"
        suffix = r"(?![\w])" if surface[-1].isalnum() else r"(?![\w])"
        # Allow an optional trailing possessive/plural. Ambiguous single-word
        # aliases (Go, Rust, Spark) are matched with their own capitalisation
        # so ordinary English usage does not register as a skill.
        if separator_tolerant:
            # "AWS Certified Machine Learning Specialty" must also match the
            # hyphenated form printed on most certificates.
            escaped = re.sub(
                r"(?:\\?\s)+", lambda _match: "[\\s\\-\u2013\u2014/]+", escaped
            )
        flags = 0 if case_sensitive else re.IGNORECASE
        if case_sensitive:
            capitalized = surface if surface[0].isupper() else surface.capitalize()
            escaped = re.escape(capitalized)
        try:
            return re.compile(rf"{prefix}{escaped}(?:'s|s\b)?{suffix}", flags)
        except re.error:  # pragma: no cover - defensive
            return None

    @staticmethod
    def _guess_degree_level(surface: str) -> str:
        lowered = surface.lower()
        if any(k in lowered for k in ("phd", "ph.d", "doctorate", "doctoral", "dphil", "md ", "jd")):
            return "phd"
        if any(k in lowered for k in ("master", "m.s", "msc", "m.sc", "mba", "m.eng", "mtech", "m.a", "postgraduate")):
            return "master"
        if any(k in lowered for k in ("bachelor", "b.s", "bsc", "b.sc", "b.eng", "btech", "bba", "bca", "undergraduate")):
            return "bachelor"
        if any(k in lowered for k in ("associate", "diploma", "hnd", "hnc")):
            return "associate"
        if any(k in lowered for k in ("certif", "license", "accredit")):
            return "certification"
        if any(k in lowered for k in ("high school", "secondary", "a-level", "ib diploma", "ged", "ssc", "hsc")):
            return "high_school"
        return "certification"

    # ------------------------------------------------------------------ #
    # Skill extraction
    # ------------------------------------------------------------------ #
    def extract_skills(self, text: str, doc: Any = None) -> List[str]:
        """Match the text against the skill taxonomy, longest-surface-first."""
        if not text:
            return []
        found: Dict[str, str] = {}  # canonical -> category
        consumed_spans: List[Tuple[int, int]] = []

        # 1. Deterministic taxonomy matching.
        for pattern, canonical, _category in self._skill_patterns:
            for match in pattern.finditer(text):
                start, end = match.span()
                if any(start < c_end and c_start < end for c_start, c_end in consumed_spans):
                    continue  # already covered by a longer skill phrase
                consumed_spans.append((start, end))
                found.setdefault(canonical, _category)

        # 2. spaCy EntityRuler SKILL entities (catches model-only findings).
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ == "SKILL":
                    canonical = self.canonicalize_skill(span.text)
                    if canonical:
                        found.setdefault(canonical, self.skill_category(canonical) or "other")

        return dedupe_preserve_order(sorted(found, key=lambda s: s.lower()))

    def extract_skills_with_categories(self, text: str, doc: Any = None) -> Dict[str, List[str]]:
        """Skills grouped by taxonomy category."""
        grouped: Dict[str, List[str]] = {}
        for skill in self.extract_skills(text, doc):
            grouped.setdefault(self.skill_category(skill) or "other", []).append(skill)
        return grouped

    def canonicalize_skill(self, surface: str) -> Optional[str]:
        """Map any surface form back to its canonical taxonomy name."""
        if not surface:
            return None
        lowered = surface.strip().lower()
        for pattern, canonical, _category in self._skill_patterns:
            if pattern.fullmatch(surface.strip()) or pattern.fullmatch(lowered):
                return canonical
        # Fall back to a direct lookup over alias lists.
        for category, entries in self.taxonomy.items():
            if category.startswith("_") or not isinstance(entries, dict):
                continue
            for canonical, aliases in entries.items():
                if lowered == str(canonical).strip().lower():
                    return str(canonical).strip()
                if isinstance(aliases, list) and lowered in {str(a).strip().lower() for a in aliases}:
                    return str(canonical).strip()
        return surface.strip()

    def skill_category(self, skill: str) -> Optional[str]:
        """Return the taxonomy category for a canonical skill."""
        lowered = skill.strip().lower()
        for category, entries in self.taxonomy.items():
            if category.startswith("_") or not isinstance(entries, dict):
                continue
            for canonical, aliases in entries.items():
                if str(canonical).strip().lower() == lowered:
                    return category
                if isinstance(aliases, list) and lowered in {str(a).strip().lower() for a in aliases}:
                    return category
        return None

    # ------------------------------------------------------------------ #
    # Dates / experience
    # ------------------------------------------------------------------ #
    def extract_dates(self, text: str) -> List[str]:
        """Human-readable date ranges present in the text."""
        dates: List[str] = []
        for match in DATE_RANGE_RE.finditer(text):
            dates.append(collapse_spaces(match.group(0)))
        for match in MONTH_YEAR_RE.finditer(text):
            value = collapse_spaces(match.group(0))
            if value not in dates:
                dates.append(value)
        return dedupe_preserve_order(dates)[:40]

    def compute_years_experience(
        self, text: str, *, exclude_text: Optional[str] = None
    ) -> Optional[float]:
        """Total professional experience in years.

        Combines (a) the span of detected date ranges, de-duplicated for
        overlaps, with (b) any explicit "X+ years of experience" statement —
        taking the larger of the two, which is how a recruiter reads a resume.

        ``exclude_text`` (normally the education section) keeps degree dates such
        as "2012 - 2016" from inflating the professional total.
        """
        ranges = self._parse_ranges(text, exclude_spans=self._excluded_spans(text, exclude_text))
        months = self._total_months(ranges)
        computed = months / 12.0 if months else 0.0

        explicit = 0.0
        summary_scope = text[:1500]
        for match in EXPLICIT_YEARS_RE.finditer(summary_scope):
            try:
                explicit = max(explicit, float(match.group("years")))
            except (TypeError, ValueError):
                continue

        best = max(computed, explicit)
        if best <= 0:
            return None
        return round(min(best, 60.0), 1)

    @staticmethod
    def _is_academic_date(text: str, position: int, window: int = 140) -> bool:
        """True when a date range sits next to degree/graduation wording."""
        start = max(0, position - window)
        end = min(len(text), position + window)
        return bool(_DEGREE_CONTEXT_RE.search(text[start:end]))

    @staticmethod
    def _excluded_spans(text: str, exclude_text: Optional[str]) -> List[Tuple[int, int]]:
        """Character spans of ``exclude_text`` inside ``text`` (empty if absent).

        Only used when the excluded block is substantial — a two-line snippet
        could otherwise match inside the experience section by accident.
        """
        if not exclude_text or len(exclude_text.strip()) < 40:
            return []
        spans: List[Tuple[int, int]] = []
        needle = exclude_text.strip()
        start = text.find(needle)
        while start != -1:
            spans.append((start, start + len(needle)))
            start = text.find(needle, start + len(needle))
        if not spans:
            # Fall back to a line-by-line match when whitespace differs slightly.
            lines = [line.strip() for line in needle.splitlines() if len(line.strip()) > 12]
            for line in lines:
                idx = text.find(line)
                if idx != -1:
                    spans.append((idx, idx + len(line)))
        return spans

    def _parse_ranges(
        self,
        text: str,
        exclude_spans: Optional[Sequence[Tuple[int, int]]] = None,
        *,
        exclude_degree_dates: bool = True,
    ) -> List[Tuple[date, date]]:
        today = date.today()
        excluded = list(exclude_spans or [])
        ranges: List[Tuple[date, date]] = []
        for match in DATE_RANGE_RE.finditer(text):
            if any(start <= match.start() < end for start, end in excluded):
                continue  # inside the education section
            if exclude_degree_dates and self._is_academic_date(text, match.start()):
                continue  # "2012 - 2016 | Graduated with honours"
            start = self._to_date(match.group("start_month"), match.group("start_year"))
            if start is None:
                continue
            if match.group("open"):
                end = today
            else:
                end = self._to_date(match.group("end_month"), match.group("end_year"))
                if end is None:
                    end = date(int(match.group("start_year")), 12, 31)
            if end < start:
                start, end = end, start
            if end.year - start.year > 40:
                continue  # noise (e.g. "2019-2023" mixed with a birth year)
            ranges.append((start, end))
        return ranges

    @staticmethod
    def _to_date(month_str: Optional[str], year_str: Optional[str]) -> Optional[date]:
        if not year_str:
            return None
        year = int(year_str)
        month = MONTHS.get((month_str or "").lower().rstrip("."), 1) if month_str else 1
        try:
            return date(year, month, 1)
        except ValueError:
            return None

    @staticmethod
    def _total_months(ranges: Sequence[Tuple[date, date]]) -> int:
        """Sum the length of ranges, ignoring overlapping periods."""
        if not ranges:
            return 0
        ordered = sorted(ranges, key=lambda r: r[0])
        merged: List[List[date]] = [[ordered[0][0], ordered[0][1]]]
        for start, end in ordered[1:]:
            if start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        total = 0
        for start, end in merged:
            total += (end.year - start.year) * 12 + (end.month - start.month) + 1
        return max(0, total)

    # ------------------------------------------------------------------ #
    # Education / certifications
    # ------------------------------------------------------------------ #
    def extract_degrees(self, text: str, doc: Any = None) -> List[str]:
        """Degree mentions, optionally qualified by their field of study."""
        found: List[str] = []
        for pattern, _level, surface in self._degree_patterns:
            if str(surface).strip().lower() in _GENERIC_DEGREE_SURFACES:
                continue
            for match in pattern.finditer(text):
                if self._is_heading_match(text, match.start()):
                    continue
                window = text[match.start(): match.start() + 160]
                found.append(self._qualify_degree(window, surface))
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ == "DEGREE" and span.text.strip().lower() not in _GENERIC_DEGREE_SURFACES:
                    found.append(span.text.strip())

        # Collapse "M.S. in Computer Science" and a bare "M.S." into one entry,
        # keeping the more informative (qualified) form.
        return self._dedupe_degrees(found)[:12]

    @staticmethod
    def _dedupe_degrees(degrees: Sequence[str]) -> List[str]:
        """Collapse bare and field-qualified forms of the same degree."""
        best: Dict[str, str] = {}
        order: List[str] = []
        for degree in degrees:
            cleaned = _prettify_degree(degree)
            key = re.sub(r"[^a-z0-9]", "", cleaned.lower().split(" in ")[0])[:5]
            if not key:
                continue
            if key not in best:
                best[key] = cleaned
                order.append(key)
            elif len(cleaned) > len(best[key]):
                best[key] = cleaned  # prefer "M.S. in Computer Science" over "M.S."
        return [best[key] for key in order]

    @staticmethod
    def _is_heading_match(text: str, position: int) -> bool:
        """True when the match sits inside an ALL-CAPS section heading."""
        line_start = text.rfind("\n", 0, position) + 1
        line_end = text.find("\n", position)
        line = text[line_start: line_end if line_end != -1 else position + 60]
        letters = [c for c in line if c.isalpha()]
        if len(letters) < 4:
            return False
        return sum(1 for c in letters if c.isupper()) / len(letters) >= 0.9

    def _qualify_degree(self, window: str, surface: str) -> str:
        """Attach a field of study when it directly follows the degree."""
        pretty = _prettify_degree(surface)
        for field in self.gazetteers.get("degree_fields", []):
            field_str = str(field)
            if re.search(rf"\bin\b\s+{re.escape(field_str)}", window, re.IGNORECASE):
                return f"{pretty} in {titleize(field_str)}"
            if re.search(
                rf"{re.escape(surface)}\s*(?:,|\(|-)?\s*{re.escape(field_str)}",
                window, re.IGNORECASE,
            ):
                return f"{pretty} in {titleize(field_str)}"
        return pretty

    def extract_education_level(self, degrees: Sequence[str], text: str = "") -> Optional[str]:
        """Highest education level detected (``phd`` > ``master`` > ...)."""
        levels: Set[str] = set()
        for degree in degrees:
            level = self._guess_degree_level(degree)
            if level in EDUCATION_LEVEL_ORDER:
                levels.add(level)
        if not levels and text:
            for pattern, level, _surface in self._degree_patterns:
                if pattern.search(text) and level in EDUCATION_LEVEL_ORDER:
                    levels.add(level)
        if not levels:
            return None
        return max(levels, key=lambda lvl: EDUCATION_LEVEL_ORDER.index(lvl))

    def extract_certifications(self, text: str, doc: Any = None) -> List[str]:
        """Certification mentions from gazetteer + NER (longest match wins)."""
        found: List[str] = []
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ == "CERTIFICATION":
                    found.append(span.text.strip())
        found.extend(self._longest_matches(text, self._cert_patterns))
        return dedupe_preserve_order(found)[:15]

    @staticmethod
    def _certifications_from_section(section_text: str, limit: int = 12) -> List[str]:
        """Read certificate names straight off a CERTIFICATIONS section.

        Gazetteers cannot cover every vendor ("Google Professional Data
        Engineer"), so the section's own lines are the source of truth.
        """
        found: List[str] = []
        for line in section_text.split("\n"):
            candidate = strip_bullets(line).strip(" ,;:-\u2013\u2014|")
            if not candidate or len(candidate) > 120:
                continue
            words = candidate.split()
            if len(words) < 2 or len(words) > 14:
                continue
            letters = sum(char.isalpha() for char in candidate)
            if letters < 8 or letters / max(len(candidate), 1) < 0.6:
                continue
            found.append(titleize(candidate))
        return dedupe_preserve_order(found)[:limit]

    # ------------------------------------------------------------------ #
    # People / organisations / places
    # ------------------------------------------------------------------ #
    def extract_person(self, text: str, doc: Any = None) -> Optional[str]:
        """Best guess at the candidate's name."""
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ == "PERSON":
                    candidate = span.text.strip()
                    if 2 <= len(candidate.split()) <= 4 and not self._looks_like_title(candidate):
                        return candidate
        # Heuristic: first line of the resume with 2-4 capitalised words.
        for line in text.split("\n")[:8]:
            line = line.strip(" -:|•")
            if not line or len(line) > 60:
                continue
            words = line.split()
            if 2 <= len(words) <= 4 and all(
                re.fullmatch(r"[A-Z][A-Za-z'’\-.]*(?:\s[A-Z][A-Za-z'’\-.]*)?", w) or w.isupper()
                for w in words
            ):
                if not self._looks_like_title(line) and not re.search(r"\d|@", line):
                    return titleize(line)
        return None

    @staticmethod
    def _looks_like_title(text: str) -> bool:
        lowered = text.lower()
        title_words = {
            "engineer", "developer", "scientist", "manager", "analyst", "designer",
            "architect", "consultant", "administrator", "specialist", "lead",
            "senior", "junior", "resume", "curriculum", "vitae", "cv", "profile",
            "summary", "experience", "education", "skills", "director", "intern",
        }
        return any(word in lowered.split() for word in title_words)

    def _longest_matches(
        self, text: str, patterns: Sequence[Tuple[Any, ...]], surface_index: int = 1
    ) -> List[str]:
        """Non-overlapping gazetteer matches, longest surface wins.

        Prevents "Data Scientist" being reported alongside "Senior Data
        Scientist" for the same span, and keeps "Google Cloud" from being
        shadowed by "Google".
        """
        hits: List[Tuple[int, int, str]] = []
        for entry in patterns:
            pattern, surface = entry[0], entry[surface_index]
            for match in pattern.finditer(text):
                hits.append((match.start(), match.end(), surface))
        hits.sort(key=lambda item: (item[0], -(item[1] - item[0])))

        chosen: List[str] = []
        last_end = -1
        for start, end, surface in hits:
            if start < last_end:
                continue
            last_end = end
            chosen.append(surface)
        return chosen

    def _is_skill_surface(self, text: str) -> bool:
        """True when an org/location candidate is actually a technology name."""
        lowered = text.strip().lower()
        for pattern, _canonical, _category in self._skill_patterns:
            if pattern.fullmatch(lowered) or pattern.fullmatch(text.strip()):
                return True
        return False

    def extract_organizations(self, text: str, doc: Any = None, limit: int = 12) -> List[str]:
        found: List[str] = []
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ == "ORG":
                    found.append(span.text.strip())
        found.extend(self._longest_matches(text, self._org_patterns))
        # Technology names (Docker, Elastic, HashiCorp...) are frequent
        # false positives for ORG in resumes — drop them.
        found = [org for org in found if not self._is_skill_surface(org)]
        return dedupe_preserve_order(found)[:limit]

    def extract_locations(self, text: str, doc: Any = None, limit: int = 8) -> List[str]:
        found: List[str] = []
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ in {"GPE", "LOC"}:
                    found.append(span.text.strip())
        found.extend(self._longest_matches(text, self._location_patterns))
        found = [loc for loc in found if not self._is_skill_surface(loc)]
        return dedupe_preserve_order(found)[:limit]

    def extract_job_titles(self, text: str, doc: Any = None, limit: int = 10) -> List[str]:
        found: List[str] = []
        if doc is not None:
            for span in getattr(doc, "ents", []):
                if span.label_ == "JOB_TITLE":
                    found.append(titleize(span.text.strip()))
        found.extend(titleize(s) for s in self._longest_matches(text, self._title_patterns))
        return dedupe_preserve_order(found)[:limit]

    # ------------------------------------------------------------------ #
    # Resume facade
    # ------------------------------------------------------------------ #
    def extract_resume_entities(
        self,
        text: str,
        doc: Any = None,
        cleaned: Optional[CleanedText] = None,
        sections: Optional[Dict[str, SectionInfo]] = None,
    ) -> ResumeEntities:
        """Build the structured resume entity bundle."""
        sections = sections or {}
        skills_scope = "\n".join(
            filter(
                None,
                [
                    sections["skills"].text if "skills" in sections else "",
                    sections["experience"].text if "experience" in sections else "",
                    sections["projects"].text if "projects" in sections else "",
                    sections["summary"].text if "summary" in sections else "",
                    sections["certifications"].text if "certifications" in sections else "",
                ],
            )
        ) or text
        skills = self.extract_skills(skills_scope, doc)
        if not skills:
            skills = self.extract_skills(text, doc)

        degrees = self.extract_degrees(
            sections.get("education", SectionInfo(name="education")).text or text, doc
        )
        cert_section = sections.get("certifications", SectionInfo(name="certifications")).text
        certifications = self.extract_certifications(cert_section or text, doc)
        if not certifications and cert_section:
            certifications = self._certifications_from_section(cert_section)
        contacts = cleaned.extracted_contacts if cleaned else None

        return ResumeEntities(
            person=self.extract_person(text, doc),
            organizations=self.extract_organizations(text, doc),
            locations=self.extract_locations(text, doc),
            dates=self.extract_dates(text),
            skills=skills,
            certifications=certifications,
            degrees=degrees,
            emails=list(contacts.emails) if contacts else [],
            phones=list(contacts.phones) if contacts else [],
            urls=list(contacts.urls) if contacts else [],
            years_experience=self.compute_years_experience(
                text,
                exclude_text=(sections.get("education").text if sections.get("education") else None),
            ),
            education_level=self.extract_education_level(degrees, text),
            job_titles=self.extract_job_titles(
                sections.get("experience", SectionInfo(name="experience")).text or text, doc
            ),
        )

    # ------------------------------------------------------------------ #
    # Job description facade
    # ------------------------------------------------------------------ #
    def extract_jd_entities(self, text: str, doc: Any = None) -> JobDescriptionEntities:
        """Build the structured job-description entity bundle."""
        required_block, preferred_block = self._split_requirement_blocks(text)

        all_skills = self.extract_skills(text, doc)
        # NOTE: blocks are matched *without* the document-wide spaCy Doc,
        # otherwise EntityRuler spans from the whole posting would leak into
        # both the required and the preferred list.
        required_skills = self.extract_skills(required_block) if required_block else []
        preferred_skills = self.extract_skills(preferred_block) if preferred_block else []

        # Skills found in the JD but not inside an explicit block default to
        # "required" — that is how most postings are written in practice.
        if not required_skills and not preferred_skills:
            required_skills = all_skills
        else:
            preferred_set = {s.lower() for s in preferred_skills}
            for skill in all_skills:
                if skill.lower() in preferred_set:
                    continue
                if skill not in required_skills:
                    required_skills.append(skill)

        min_years = self.extract_min_years(text)
        experience_requirement = self._experience_requirement_phrase(text, min_years)
        degree_requirement = self._degree_requirement_phrase(text)

        titles = self.extract_job_titles(text, doc)
        organization = self._extract_jd_organization(text, doc)
        location = self._extract_jd_location(text, doc)

        salary = SALARY_RE.search(text)
        return JobDescriptionEntities(
            organization=organization,
            location=location,
            job_title=self._explicit_job_title(text) or (titles[0] if titles else None),
            required_skills=dedupe_preserve_order(required_skills),
            preferred_skills=dedupe_preserve_order(preferred_skills),
            soft_skills=self._extract_soft_skills(text),
            degree_requirement=degree_requirement,
            experience_requirement=experience_requirement,
            min_years_experience=min_years,
            salary_range=collapse_spaces(salary.group(0)) if salary else None,
            certifications=self.extract_certifications(text, doc),
        )

    def extract_min_years(self, text: str) -> Optional[float]:
        """Minimum years of experience requested by the posting."""
        best: Optional[float] = None
        for match in JD_YEARS_RE.finditer(text):
            window = text[max(0, match.start() - 120): match.end() + 120].lower()
            if not any(word in window for word in ("experience", "years in", "yrs", "background", "practice")):
                continue
            try:
                low = float(match.group("low"))
            except (TypeError, ValueError):
                continue
            if low > 40:
                continue
            best = low if best is None else max(best, low)
        return best

    def _experience_requirement_phrase(self, text: str, min_years: Optional[float]) -> Optional[str]:
        if min_years is not None:
            return f"{int(min_years)}+ years"
        match = JD_YEARS_RE.search(text)
        return collapse_spaces(match.group(0)) if match else None

    def _degree_requirement_phrase(self, text: str) -> Optional[str]:
        """Return the sentence that states the education requirement."""
        best: Optional[Tuple[int, str]] = None
        for pattern, _level, surface in self._degree_patterns:
            for match in pattern.finditer(text):
                window = text[max(0, match.start() - 90): match.end() + 90]
                if not re.search(
                    r"\b(degree|bachelor|master|phd|diploma|graduat|qualification|equivalent|preferred|required)\b",
                    window, re.IGNORECASE,
                ):
                    continue
                sentence = self._containing_sentence(text, match.start())
                if not sentence:
                    continue
                priority = 0 if re.search(r"\b(required|minimum|must)\b", sentence, re.IGNORECASE) else 1
                candidate = (priority, sentence)
                if best is None or candidate[0] < best[0]:
                    best = candidate
        return best[1] if best else None

    @staticmethod
    def _containing_sentence(text: str, position: int) -> str:
        """Sentence (or bullet line) surrounding ``position`` in ``text``."""
        start = max(text.rfind("\n", 0, position), text.rfind(".", 0, position - 1))
        start = 0 if start == -1 else start + 1
        end_candidates = [
            idx for idx in (text.find("\n", position), text.find(".", position + 1)) if idx != -1
        ]
        end = min(end_candidates) + 1 if end_candidates else min(len(text), position + 160)
        sentence = collapse_spaces(text[start:end]).strip(" -•:|")
        return sentence[:220]

    def _split_requirement_blocks(self, text: str) -> Tuple[str, str]:
        """Split the JD into 'required' and 'preferred' text blocks."""
        markers = self.gazetteers.get("requirement_markers", {})
        required_markers = markers.get("required", [])
        preferred_markers = markers.get("preferred", [])

        lines = text.split("\n")
        required_lines: List[str] = []
        preferred_lines: List[str] = []
        current: Optional[str] = None

        for line in lines:
            normalized = line.strip().lower().rstrip(":")
            normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
            normalized = " ".join(normalized.split())
            if not normalized:
                continue

            if any(normalized.startswith(m) or normalized == m for m in preferred_markers):
                current = "preferred"
                continue
            if any(normalized.startswith(m) or normalized == m for m in required_markers):
                current = "required"
                continue
            if len(normalized.split()) <= 6 and re.search(
                r"\b(benefits|perks|about us|company|who we are|equal opportunity)\b", normalized
            ):
                current = None
                continue
            if current == "required":
                required_lines.append(line)
            elif current == "preferred":
                preferred_lines.append(line)

        return "\n".join(required_lines), "\n".join(preferred_lines)

    def _extract_soft_skills(self, text: str) -> List[str]:
        """Soft-skill detection tolerant of inflection.

        Multi-word aliases must appear verbatim; single-word aliases match on a
        4-character prefix so "Mentor" finds "mentoring" and "Collaborate"
        finds "collaboration".
        """
        soft = self.taxonomy.get("soft_skills", {})
        if not isinstance(soft, dict):
            return []

        normalized = " ".join(text.lower().split())
        text_words = [w for w in WORDISH_RE.findall(normalized) if len(w) >= 5]
        prefixes = {w[:4] for w in text_words}

        found: List[str] = []
        for canonical, aliases in soft.items():
            surfaces = [str(canonical)] + [str(a) for a in (aliases or []) if a]
            for surface in surfaces:
                surface = " ".join(surface.strip().lower().split())
                if not surface:
                    continue
                if " " in surface:
                    if surface in normalized:
                        found.append(str(canonical))
                        break
                    continue
                if len(surface) >= 5 and surface[:4] in prefixes:
                    found.append(str(canonical))
                    break
        return dedupe_preserve_order(found)

    def _explicit_job_title(self, text: str) -> Optional[str]:
        match = _JOB_TITLE_LINE_RE.search(text)
        if match:
            return titleize(match.group(1).strip()[:80])
        first_lines = [line.strip() for line in text.split("\n")[:6] if line.strip()]
        for line in first_lines:
            if len(line.split()) <= 8 and not re.search(r"\d|@|http", line):
                for pattern, surface in self._title_patterns:
                    if pattern.search(line):
                        return titleize(surface)

        # Fallback: postings almost always lead with the role, and the gazetteer
        # only covers technology titles ("Paediatric ICU Registered Nurse —
        # Austin Children's Hospital" would otherwise yield nothing).
        for line in first_lines:
            candidate = self._title_candidate(line)
            if candidate and self._is_title_shaped(candidate):
                return titleize(candidate)
        return None

    #: Separators that split a role from its employer on a title line.
    _TITLE_SEPARATORS = ("—", "–", "|", " - ", " :: ", " at ", "·")

    @classmethod
    def _title_candidate(cls, line: str) -> str:
        candidate = (line or "").strip()
        for separator in cls._TITLE_SEPARATORS:
            if separator in candidate:
                candidate = candidate.split(separator)[0]
        return candidate.strip(" ,:-–—|·")

    def _is_title_shaped(self, candidate: str) -> bool:
        """Heuristic: does this look like a job title rather than prose/a company?"""
        words = candidate.split()
        if not 2 <= len(words) <= 8:
            return False
        if re.search(r"\d|@|http|\.com|\.org|\.io", candidate):
            return False
        if candidate.endswith(".") or candidate.isupper():
            return False
        if self._strip_legal_suffix(candidate) != candidate:
            return False  # a company name, not a role
        if re.search(
            r"\b(?:we|our|us|are|is|will|you|looking|seeking|join|hiring|about|benefits|"
            r"responsibilities|requirements|qualifications|description)\b",
            candidate,
            re.IGNORECASE,
        ):
            return False
        capitalised = sum(1 for word in words if word[0].isupper())
        return capitalised >= max(2, len(words) - 2)

    #: Words that disqualify a candidate company name.
    _ORG_STOP_WORDS = {
        "our", "the", "a", "an", "we", "us", "team", "teams", "company", "this",
        "your", "their", "all", "any", "role", "position", "candidate", "candidates",
        "engineers", "engineer", "manager", "analyst", "remote", "hybrid", "onsite",
    }

    def _extract_jd_organization(self, text: str, doc: Any = None) -> Optional[str]:
        """Best guess at the hiring company named in the posting."""
        head = text[:2000]

        # 1. Explicit label ("Company: TechCorp").
        match = re.search(
            r"(?:company|employer|organization|organisation|about\s+us|about\s+the\s+company)"
            r"\s*[:\-]\s*(.+)",
            head,
            re.IGNORECASE,
        )
        if match:
            candidate = match.group(1).split("\n")[0].strip(" .,-–—|")
            if self._is_valid_org(candidate):
                return self._strip_legal_suffix(candidate) or candidate

        # 2. Company name on the title line ("Senior Engineer — TechCorp Inc.").
        for line in head.split("\n")[:6]:
            line = line.strip()
            if not line:
                continue
            for separator in ("—", "–", "|", " - ", " at ", " :: "):
                if separator in line:
                    tail = line.split(separator)[-1].strip(" .,-")
                    if self._is_valid_org(tail):
                        return self._strip_legal_suffix(tail) or tail

        # 3. Legal-suffix scan anywhere in the header area.
        match = re.search(
            r"\b([A-Z][A-Za-z0-9&'\-]*(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,4}"
            r"\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|GmbH|PLC|Group|Technologies|Labs|Systems))\b",
            head,
        )
        if match and self._is_valid_org(match.group(1)):
            return self._strip_legal_suffix(match.group(1)) or match.group(1)

        # 4. "join <ProperName>" — case sensitive so "join our team" is ignored.
        match = re.search(r"\b(?:join|at)\s+([A-Z][A-Za-z0-9&'\-]+(?:\s+[A-Z][A-Za-z0-9&'\-]+){0,4})", head)
        if match and self._is_valid_org(match.group(1)):
            return self._strip_legal_suffix(match.group(1)) or match.group(1)

        # 5. Gazetteer hit.
        orgs = self.extract_organizations(head, doc, limit=3)
        return orgs[0] if orgs else None

    def _is_valid_org(self, candidate: Optional[str]) -> bool:
        if not candidate:
            return False
        words = candidate.strip().split()
        if not 1 <= len(words) <= 6:
            return False
        if any(w.strip(".,").lower() in self._ORG_STOP_WORDS for w in words):
            return False
        if candidate.count("\n"):
            return False
        return not self._looks_like_title(candidate)

    @staticmethod
    def _strip_legal_suffix(name: str) -> str:
        """Drop a trailing legal suffix so 'TechCorp Inc.' -> 'TechCorp'."""
        return re.sub(
            r"\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|GmbH|PLC|Co\.?)$", "", name.strip()
        ).strip(" .,-")

    #: Posting metadata that often trails a location on the same line.
    _LOCATION_TRAILERS = (
        "|", ";", "//", "employment", "job type", "type:", "salary", "compensation",
        "posted", "apply", "requisition", "req id", "shift", "schedule",
    )

    @classmethod
    def _clean_location(cls, value: str) -> Optional[str]:
        """Trim a captured location down to the place itself."""
        cleaned = (value or "").strip()
        if not cleaned:
            return None
        for line_sep in ("\n", "\r"):
            cleaned = cleaned.split(line_sep)[0]
        lowered = cleaned.lower()
        cut = len(cleaned)
        for trailer in cls._LOCATION_TRAILERS:
            idx = lowered.find(trailer)
            if idx > 0:
                cut = min(cut, idx)
        cleaned = cleaned[:cut].strip(" ,:-–—|")
        cleaned = collapse_spaces(cleaned)
        if not cleaned or len(cleaned) > 60 or re.search(r"\d{4,}", cleaned):
            return None
        return cleaned

    def _extract_jd_location(self, text: str, doc: Any = None) -> Optional[str]:
        match = _LOCATION_LINE_RE.search(text)
        if match:
            cleaned = self._clean_location(match.group(1))
            if cleaned:
                return cleaned[:80]
        if re.search(r"\b(remote|work from home|wfh|fully remote|anywhere)\b", text, re.IGNORECASE):
            return "Remote"
        locations = [self._clean_location(loc) for loc in self.extract_locations(text, doc, limit=3)]
        locations = [loc for loc in locations if loc]
        return locations[0] if locations else None


def collapse_spaces(text: str) -> str:
    """Collapse internal whitespace (kept local to avoid an import cycle)."""
    return " ".join((text or "").split())


#: Shared extractor instance (built lazily to avoid import-time file reads).
_extractor: Optional[EntityExtractor] = None


def get_entity_extractor(pipeline: Optional[NLPPipeline] = None) -> EntityExtractor:
    """Return a process-wide :class:`EntityExtractor`."""
    global _extractor
    if _extractor is None:
        _extractor = EntityExtractor(nlp_pipeline=pipeline)
    return _extractor


__all__ = ["EntityExtractor", "get_entity_extractor", "EDUCATION_LEVEL_ORDER", "collapse_spaces"]
