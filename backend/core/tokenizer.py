"""Stage 3-6 — tokenization with technical-term protection.

spaCy's default tokenizer splits ``C++`` into ``C`` + ``++`` and ``Node.js``
into ``Node`` + ``.``, which destroys exactly the tokens a resume matcher cares
about most. This module registers *special cases* so compound technical terms
survive tokenization intact, then emits fully annotated tokens
(text / lemma / POS / fine tag / stop / punctuation flags / dependency).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from models.schemas import TokenInfo, TokenizedText
from utils.logger import get_logger

logger = get_logger(__name__)

#: Tokens that must never be split by the tokenizer.
SPECIAL_CASES: Sequence[str] = (
    "c++", "C++", "c#", "C#", ".net", ".NET", "asp.net", "ASP.NET", "f#", "F#",
    "node.js", "Node.js", "next.js", "Next.js", "nuxt.js", "vue.js", "Vue.js",
    "react.js", "angular.js", "express.js", "tensorflow.js", "three.js",
    "objective-c", "Objective-C", "scikit-learn", "sentence-transformers",
    "ci/cd", "CI/CD", "r&d", "R&D", "q&a", "e-commerce", "full-stack",
    "front-end", "back-end", "cross-platform", "xgboost", "k8s", "K8s",
    "gpt-4", "GPT-4", "gpt-3.5", "b2b", "B2B", "b2c", "B2C", "saas", "SaaS",
    "paas", "PaaS", "iaas", "IaaS", "nlp", "NLP", "ml", "ML", "ai", "AI",
    "mlops", "MLOps", "devops", "DevOps", "sql", "SQL", "nosql", "NoSQL",
    "github", "GitHub", "javascript", "JavaScript", "typescript", "TypeScript",
    "postgresql", "PostgreSQL", "mongodb", "MongoDB", "elasticsearch",
    "Elasticsearch", "kubernetes", "Kubernetes", "terraform", "Terraform",
    "tensorflow", "TensorFlow", "pytorch", "PyTorch", "langchain", "LangChain",
    "hugging face", "Hugging Face", "chatgpt", "ChatGPT", "power bi", "Power BI",
    "google cloud", "Google Cloud", "amazon web services", "AWS", "aws",
    "gcp", "GCP", "azure", "Azure", "docker", "Docker", "jira", "Jira",
    "figma", "Figma", "tableau", "Tableau", "excel", "Excel", "vba", "VBA",
    "power bi", "looker", "Looker", "snowflake", "Snowflake", "databricks",
    "Databricks", "airflow", "Airflow", "kafka", "Kafka", "spark", "Spark",
    "pyspark", "PySpark", "hadoop", "Hadoop", "redis", "Redis",
    "swift", "Swift", "kotlin", "Kotlin", "golang", "GoLang", "rust", "Rust",
    "ruby on rails", "Ruby on Rails", "spring boot", "Spring Boot",
    "fastapi", "FastAPI", "django", "Django", "flask", "Flask",
    "rest api", "REST API", "rest apis", "graphql", "GraphQL", "grpc", "gRPC",
    "oauth", "OAuth", "jwt", "JWT", "sso", "SSO", "iam", "IAM",
    "tdd", "TDD", "bdd", "BDD", "ddd", "DDD", "oop", "OOP",
    "mvc", "MVC", "crud", "CRUD", "orm", "ORM", "sdk", "SDK", "api", "API",
    "apis", "APIs", "cli", "CLI", "ui", "UI", "ux", "UX", "seo", "SEO",
    "a/b testing", "A/B testing", "etl", "ETL", "elt", "ELT", "bi", "BI",
    "kpi", "KPI", "kpis", "KPIs", "okr", "OKR", "roi", "ROI", "gpa", "GPA",
    "phd", "PhD", "ph.d.", "Ph.D.", "ms", "M.S.", "bs", "B.S.", "mba", "MBA",
    "b.tech", "B.Tech", "m.tech", "M.Tech", "bca", "BCA", "mca", "MCA",
)

_WORD_TOKEN_RE = re.compile(r"[\w']+(?:[+#.\-/][\w']+)*")

#: POS tags that can live inside a noun phrase.
_NOUN_PHRASE_POS = {"NOUN", "PROPN", "ADJ", "NUM", "DET", "X"}
#: POS tags that always terminate a phrase.
_NOUN_PHRASE_BREAK = {"VERB", "AUX", "ADP", "CONJ", "CCONJ", "SCONJ", "PUNCT", "PART", "PRON", "ADV"}


def _heuristic_noun_chunks(doc: Any) -> List[str]:
    """POS-based noun-phrase chunker used when spaCy's chunker cannot run.

    spaCy's ``Doc.noun_chunks`` walks the dependency graph, and a heuristic
    parser can emit arcs that make it raise ``IndexError [E035]`` (span start
    after span end). Rather than losing phrases entirely we group consecutive
    nominal tokens, which recovers the multi-word technical terms
    ("machine learning models", "real time fraud detection") that downstream
    keyword extraction relies on.
    """
    chunks: List[str] = []
    buffer: List[str] = []

    def flush() -> None:
        if not buffer:
            return
        # Drop leading determiners/adjectives so "the machine learning" -> "machine learning".
        while buffer and buffer[0].lower() in {"the", "a", "an", "our", "their", "your", "this", "that", "these", "those"}:
            buffer.pop(0)
        if len(buffer) >= 2:
            chunks.append(" ".join(buffer))
        buffer.clear()

    for token in doc:
        text = token.text.strip()
        if not text:
            continue
        pos = (getattr(token, "pos_", "") or "").upper()
        is_punct = bool(getattr(token, "is_punct", False)) or (not text[0].isalnum() and "-" not in text)
        if is_punct or pos in _NOUN_PHRASE_BREAK:
            flush()
            continue
        if pos in _NOUN_PHRASE_POS or (not pos and text[0].isalnum()):
            buffer.append(text.lower())
            if len(buffer) >= 6:  # cap phrase length
                flush()
        else:
            flush()
    flush()
    return chunks


def extract_noun_chunks(doc: Any, *, min_length: int = 3, max_length: int = 60) -> List[str]:
    """Return normalised noun phrases from a spaCy ``Doc``, never raising.

    Tries spaCy's dependency-based chunker first and transparently falls back to
    :func:`_heuristic_noun_chunks` when the pipeline lacks a parser or when the
    heuristic arcs confuse spaCy.
    """
    if doc is None:
        return []
    raw: List[str] = []
    try:
        raw = [chunk.text for chunk in doc.noun_chunks]
    except Exception as exc:  # noqa: BLE001 - E035 IndexError, NotImplementedError, ...
        logger.debug(
            "spacy_noun_chunks_unavailable",
            extra={"error": f"{type(exc).__name__}: {exc}"},
        )
        raw = []

    heuristic = _heuristic_noun_chunks(doc)
    if not raw:
        raw = heuristic
    elif not any(" " in chunk for chunk in raw):
        # The dependency graph produced only single-token chunks (typical for the
        # offline heuristic parser). The POS-based chunker recovers the
        # multi-word phrases keyword extraction depends on.
        if any(" " in chunk for chunk in heuristic):
            raw = heuristic

    cleaned: List[str] = []
    for chunk in raw:
        normalised = re.sub(r"\s+", " ", (chunk or "").strip().lower()).strip(" .,:;-")
        if min_length < len(normalised) <= max_length:
            cleaned.append(normalised)
    return cleaned


class Tokenizer:
    """Wraps a spaCy ``Language`` pipeline and emits annotated tokens."""

    _SPECIAL_CASES_FLAG = "_ats_special_cases_registered"

    def __init__(self, nlp_model: Any, register_special_cases: bool = True) -> None:
        self.nlp = nlp_model
        if register_special_cases:
            self._register_special_cases()

    # ------------------------------------------------------------------ #
    def _register_special_cases(self) -> None:
        """Teach the tokenizer about compound technical terms (once per model)."""
        if getattr(self.nlp, self._SPECIAL_CASES_FLAG, False):
            return
        added = 0
        tokenizer = getattr(self.nlp, "tokenizer", None)
        if tokenizer is None or not hasattr(tokenizer, "add_special_case"):
            return
        for term in SPECIAL_CASES:
            try:
                # ORTH-only special cases: annotation (POS/lemma) is filled in by
                # the pipeline components that run after tokenization.
                tokenizer.add_special_case(term, [{"ORTH": term}])
                added += 1
            except Exception as exc:  # noqa: BLE001 - never fail on a special case
                logger.debug("special_case_skipped", extra={"term": term, "error": str(exc)})
        setattr(self.nlp, self._SPECIAL_CASES_FLAG, True)
        logger.info("tokenizer_special_cases_registered", extra={"count": added})

    # ------------------------------------------------------------------ #
    def tokenize(self, text: str, *, max_chars: Optional[int] = None) -> TokenizedText:
        """Tokenize, POS-tag, lemmatise and sentence-split ``text``."""
        if not text or not text.strip():
            return TokenizedText()
        return self.annotate(self.make_doc(text, max_chars=max_chars))

    def annotate(self, doc: Any) -> TokenizedText:
        """Build a :class:`TokenizedText` from an already-processed spaCy ``Doc``.

        Callers that already hold a ``Doc`` (e.g. :class:`~core.nlp_pipeline.NLPPipeline`)
        use this to avoid running the pipeline twice over the same text.
        """
        tokens: List[TokenInfo] = []
        for token in doc:
            if token.is_space:
                continue
            tokens.append(
                TokenInfo(
                    text=token.text,
                    lemma=self._lemma(token),
                    pos=token.pos_ or "X",
                    tag=token.tag_ or "",
                    is_stop=bool(token.is_stop),
                    is_punct=bool(token.is_punct),
                    is_alpha=bool(token.is_alpha),
                    is_digit=bool(token.is_digit),
                    dep=token.dep_ or "",
                )
            )

        sentences = [s.text.strip() for s in self._sentences(doc) if s.text.strip()]
        noun_chunks = self._noun_chunks(doc)
        content_tokens = [t.text.lower() for t in tokens if not t.is_punct]

        return TokenizedText(
            tokens=tokens,
            sentences=sentences,
            noun_chunks=noun_chunks,
            pos_distribution=self._pos_distribution(tokens),
            word_count=len(content_tokens),
            unique_tokens=len(set(content_tokens)),
        )

    def make_doc(self, text: str, *, max_chars: Optional[int] = None) -> Any:
        """Run the spaCy pipeline, guarding against pathological inputs."""
        cleaned = text.replace("\x00", " ")
        if max_chars and len(cleaned) > max_chars:
            logger.warning(
                "document_truncated", extra={"chars": len(cleaned), "limit": max_chars}
            )
            cleaned = cleaned[:max_chars]
        try:
            return self.nlp(cleaned)
        except ValueError as exc:
            # spaCy raises when the document exceeds nlp.max_length.
            if "max_length" in str(exc):
                limit = getattr(self.nlp, "max_length", 1_000_000)
                logger.warning("document_exceeded_max_length", extra={"limit": limit})
                return self.nlp(cleaned[: max(1000, limit - 10)])
            raise

    # ------------------------------------------------------------------ #
    @staticmethod
    def _lemma(token: Any) -> str:
        lemma = getattr(token, "lemma_", "") or ""
        if lemma:
            return lemma.strip()
        return token.text.lower()

    @staticmethod
    def _sentences(doc: Any) -> List[Any]:
        try:
            return list(doc.sents)
        except ValueError:
            # No sentencizer / parser available: treat the whole doc as one sentence.
            return [doc]

    @staticmethod
    def _noun_chunks(doc: Any) -> List[str]:
        """Noun phrases, degrading gracefully when spaCy's chunker cannot run."""
        return extract_noun_chunks(doc)

    @staticmethod
    def _pos_distribution(tokens: Sequence[TokenInfo]) -> Dict[str, int]:
        """Count universal POS tags. Whitespace tokens are never passed in."""
        distribution: Dict[str, int] = {}
        for token in tokens:
            distribution[token.pos] = distribution.get(token.pos, 0) + 1
        return distribution


__all__ = ["Tokenizer", "SPECIAL_CASES"]
