"""Small, dependency-free text helpers shared by the NLP core modules."""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from typing import Iterable, Sequence

# --------------------------------------------------------------------------- #
# Regex building blocks (compiled once)
# --------------------------------------------------------------------------- #
URL_RE = re.compile(
    r"""(?i)\b(?:https?://|www\.)[^\s<>"']+|\b[\w.+-]+@[\w-]+\.[\w.-]+""", re.VERBOSE
)
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(
    r"""(?<![\w.])(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?![\w.])"""
)
WHITESPACE_RE = re.compile(r"[ \t\r\f\v]+")
BLANK_LINES_RE = re.compile(r"\n{3,}")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
BULLET_RE = re.compile(r"^\s*(?:[•·▪◦‣∙*+\-–—\u2022]|\d+[.)])\s+")

# Common ligature / smart-quote replacements produced by PDF writers.
_CHAR_MAP = {
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u00a0": " ",
    "\u2022": "*", "\u25cf": "*", "\u25aa": "*", "\uf0b7": "*",
    "\uf0a7": "*", "\u200b": "", "\u200c": "", "\u200d": "", "\ufeff": "",
    "\u2028": "\n", "\u2029": "\n", "\u00ad": "",
    "\ufb01": "fi", "\ufb02": "fl", "\ufb00": "ff", "\ufb03": "ffi", "\ufb04": "ffl",
}

# OCR mis-reads that are frequent in scanned resumes.
_OCR_FIXES = {
    r"\brn\b": "m", r"\bcl\b": "d", r"\bvvh\b": "w", r"\btl\b": "h",
    r"(?<=[a-z])0(?=[a-z])": "o", r"(?<=[a-z])1(?=[a-z])": "l",
    r"(?<=[a-z])5(?=[a-z])": "s", r"(?<=[a-z])8(?=[a-z])": "b",
    r"\s+([,.;:!?])": r"\1", r"([,;:])(?=[A-Za-z])": r"\1 ",
}

# Technical tokens that must survive lower-casing/punctuation stripping intact.
PROTECTED_TERMS = (
    "c++", "c#", "c/c++", ".net", "asp.net", "node.js", "next.js", "nuxt.js",
    "vue.js", "express.js", "react.js", "angular.js", "tensorflow.js",
    "objective-c", "f#", "asp", "scikit-learn", "xgboost", "lightgbm",
    "ci/cd", "nlp", "ml", "ai", "gcp", "aws", "k8s", "r&d", "q&a",
    "e-commerce", "full-stack", "front-end", "back-end", "cross-platform",
)

#: Lower-cased acronym -> display form, used by :func:`titleize` so job titles,
#: degrees and locations keep conventional capitalisation.
ACRONYM_DISPLAY: dict[str, str] = {
    # Healthcare / clinical
    "icu": "ICU", "rn": "RN", "bsn": "BSN", "msn": "MSN", "np": "NP",
    "lpn": "LPN", "cna": "CNA", "emt": "EMT", "cpr": "CPR", "bls": "BLS",
    "acls": "ACLS", "nicu": "NICU", "picu": "PICU", "er": "ER",
    # Technology
    "it": "IT", "ai": "AI", "ml": "ML", "nlp": "NLP", "sql": "SQL",
    "nosql": "NoSQL", "api": "API", "apis": "APIs", "ux": "UX", "ui": "UI",
    "qa": "QA", "qc": "QC", "hr": "HR", "r&d": "R&D", "etl": "ETL",
    "elt": "ELT", "erp": "ERP", "crm": "CRM", "cms": "CMS", "iot": "IoT",
    "vr": "VR", "ar": "AR", "xr": "XR", "gpu": "GPU", "cpu": "CPU",
    "sdk": "SDK", "cli": "CLI", "seo": "SEO", "sem": "SEM", "ppc": "PPC",
    "kpi": "KPI", "kpis": "KPIs", "okr": "OKR", "okrs": "OKRs", "roi": "ROI",
    "gpa": "GPA", "tdd": "TDD", "bdd": "BDD", "ddd": "DDD", "oop": "OOP",
    "mvc": "MVC", "orm": "ORM", "sla": "SLA", "saas": "SaaS", "paas": "PaaS",
    "iaas": "IaaS", "b2b": "B2B", "b2c": "B2C", "k8s": "K8s",
    "ci/cd": "CI/CD", "devops": "DevOps", "mlops": "MLOps", "aws": "AWS",
    "gcp": "GCP", "ec2": "EC2", "s3": "S3", "iam": "IAM", "sso": "SSO",
    "oauth": "OAuth", "jwt": "JWT", "grpc": "gRPC", "html": "HTML",
    "css": "CSS", "js": "JS", "ts": "TS", "jsx": "JSX", "tsx": "TSX",
    "sap": "SAP", "hadoop": "Hadoop", "spark": "Spark",
    # Executive / management
    "ceo": "CEO", "cto": "CTO", "cfo": "CFO", "coo": "COO", "cmo": "CMO",
    "vp": "VP", "svp": "SVP", "evp": "EVP", "gm": "GM", "pm": "PM",
    "pmo": "PMO", "em": "EM", "tl": "TL",
    # Academic
    "phd": "PhD", "ph.d.": "Ph.D.", "md": "MD", "jd": "JD", "mba": "MBA",
    "mca": "MCA", "bca": "BCA", "mphil": "MPhil",
    # Geography
    "us": "US", "usa": "USA", "uk": "UK", "eu": "EU", "uae": "UAE",
    "apac": "APAC", "emea": "EMEA", "nyc": "NYC", "sf": "SF",
}


def normalize_unicode(text: str, form: str = "NFKC") -> str:
    """Apply unicode normalisation and map typographic characters to ASCII."""
    if not text:
        return ""
    text = unicodedata.normalize(form, text)
    for src, dst in _CHAR_MAP.items():
        if src in text:
            text = text.replace(src, dst)
    # Strip combining marks left over from NFKD-style normalisation.
    decomposed = unicodedata.normalize("NFKD", text)
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return without_marks.encode("ascii", "ignore").decode("ascii") if _is_mostly_ascii(text) else without_marks


def _is_mostly_ascii(text: str, threshold: float = 0.95) -> bool:
    if not text:
        return True
    ascii_chars = sum(1 for ch in text if ord(ch) < 128)
    return ascii_chars / len(text) >= threshold


def strip_control_chars(text: str) -> str:
    """Remove non-printable control characters (keeps newlines and tabs)."""
    return CONTROL_CHARS_RE.sub("", text)


def collapse_whitespace(text: str) -> str:
    """Collapse runs of spaces/tabs and trim blank lines."""
    text = WHITESPACE_RE.sub(" ", text)
    text = BLANK_LINES_RE.sub("\n\n", text)
    return "\n".join(line.strip() for line in text.split("\n")).strip()


def fix_ocr_artifacts(text: str) -> str:
    """Best-effort repair of typical OCR noise."""
    for pattern, repl in _OCR_FIXES.items():
        text = re.sub(pattern, repl, text)
    return text


def strip_bullets(line: str) -> str:
    """Remove a leading bullet/numbering marker from a line."""
    return BULLET_RE.sub("", line).strip()


def is_section_header_candidate(line: str) -> bool:
    """Heuristic: does this line look like a resume section heading?"""
    stripped = line.strip().rstrip(":")
    if not stripped or len(stripped) > 60:
        return False
    letters = [c for c in stripped if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    word_count = len(stripped.split())
    if word_count <= 6 and (upper_ratio > 0.8 or stripped.endswith(":")):
        return True
    return False


def titleize(text: str) -> str:
    """Title-case a phrase while keeping acronyms and tech casing intact.

    "paediatric icu registered nurse" -> "Paediatric ICU Registered Nurse";
    "senior pytorch engineer" -> "Senior PyTorch Engineer" (internal capitals in
    the source are preserved rather than flattened).
    """
    if not text:
        return text
    small = {"of", "and", "for", "in", "on", "with", "to", "the", "a", "an", "at", "or", "from"}
    protected_lookup = {term.lower(): term for term in PROTECTED_TERMS}

    out: list[str] = []
    for idx, word in enumerate(text.split()):
        bare = word.strip(".,;:()[]'\"").lower()
        if bare in ACRONYM_DISPLAY:
            out.append(word.replace(bare, ACRONYM_DISPLAY[bare]) if word.lower() != bare else ACRONYM_DISPLAY[bare])
            continue
        if bare in protected_lookup:
            out.append(word.replace(bare, protected_lookup[bare]) if word.lower() == bare else word)
            continue
        # Keep an all-caps token as the author wrote it ("ICU", "AWS").
        if word.isupper() and len(bare) <= 6:
            out.append(word)
            continue
        if idx != 0 and bare in small:
            out.append(bare)
            continue
        # Preserve internal capitalisation ("PyTorch", "JavaScript", "iPhone").
        if any(c.isupper() for c in word[1:]) and not word.isupper():
            out.append(word)
            continue
        out.append(word[:1].upper() + word[1:].lower())
    return " ".join(out)


def dedupe_preserve_order(items: Iterable[str]) -> list[str]:
    """Deduplicate a sequence while preserving first-seen order."""
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            result.append(item.strip())
    return result


def chunk_text(text: str, max_chars: int = 2000, overlap: int = 200) -> list[str]:
    """Split long text into overlapping sentence-aware chunks."""
    if max_chars <= 0:
        return [text]
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            boundary = max(text.rfind(". ", start, end), text.rfind("\n", start, end))
            if boundary > start + max_chars // 2:
                end = boundary + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def token_frequencies(tokens: Sequence[str]) -> Counter:
    """Frequency counter over already-normalised tokens."""
    return Counter(t.lower() for t in tokens if t)


def safe_ratio(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Division that never raises on a zero denominator."""
    return numerator / denominator if denominator else default


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    """Clamp ``value`` into ``[low, high]``."""
    return max(low, min(high, value))


def percentile_rank(value: float, values: Sequence[float]) -> float:
    """Rank ``value`` against ``values`` as a 0-1 fraction."""
    if not values:
        return 0.0
    below = sum(1 for v in values if v <= value)
    return below / len(values)


def truncate(text: str, limit: int = 280) -> str:
    """Truncate for previews/history listings."""
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "\u2026"
