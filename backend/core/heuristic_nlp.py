"""Offline-capable NLP components.

The production deployment loads spaCy's ``en_core_web_lg`` (or ``_sm``) which
provides a statistical tagger, lemmatiser, dependency parser and NER model.
Those models are *downloaded artefacts* and may be unavailable — air-gapped
installations, CI sandboxes, first-boot containers with no network, etc.

This module keeps the full NLP pipeline functional in that situation by
providing deterministic, rule-based replacements that plug into the very same
spaCy ``Doc`` object:

===========================  ==================================================
Pipeline stage               Offline implementation
===========================  ==================================================
Tokenization                 spaCy's own English tokenizer (``spacy.blank("en")``)
Sentence segmentation        spaCy ``sentencizer`` (punctuation rules)
POS tagging                  :class:`HeuristicPOSTagger` — lexicon + morphology
                             + context rules
Lemmatization                :class:`RuleBasedLemmatizer` — irregular tables +
                             suffix stripping
Dependency parsing           :class:`ShallowDependencyParser` — phrase-structure
                             heuristics (enough for ``noun_chunks``, subject /
                             object extraction and action-verb analysis)
NER                          spaCy ``EntityRuler`` driven by the JSON gazetteers
                             and the skill taxonomy
===========================  ==================================================

When a statistical model *is* available none of this is used: the pipeline
reports ``variant="statistical"`` and every annotation comes from the model.
"""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import spacy
from spacy.language import Language
from spacy.tokens import Doc
from spacy.util import filter_spans

from config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# --------------------------------------------------------------------------- #
# Universal POS -> Penn Treebank tag approximation
# --------------------------------------------------------------------------- #
_TAG_MAP: Dict[str, str] = {
    "NOUN": "NN", "PROPN": "NNP", "VERB": "VB", "ADJ": "JJ", "ADV": "RB",
    "DET": "DT", "PRON": "PRP", "ADP": "IN", "CCONJ": "CC", "SCONJ": "IN",
    "AUX": "VB", "NUM": "CD", "PART": "RP", "PUNCT": ".", "SYM": "$",
    "SPACE": "_SP", "X": "FW", "INTJ": "UH",
}

_ACRONYM_RE = re.compile(r"^[A-Z][A-Za-z0-9+#.\-]{1,11}$")
_ALLCAPS_RE = re.compile(r"^[A-Z][A-Z0-9+#.\-/]{0,9}$")
_DIGIT_RE = re.compile(r"^[\d,.\-/%+:]+$")

# Tokens that force the following word to be a verb ("can build", "to design").
_VERB_TRIGGERS = {
    "can", "could", "will", "would", "shall", "should", "may", "might",
    "must", "to", "help", "helps", "helped", "let", "lets", "make",
    "makes", "made", "need", "needs", "needed", "want", "wants",
}
# Tokens that force the following word to be a noun ("the design", "our team").
_NOUN_TRIGGERS = {
    "the", "a", "an", "this", "that", "these", "those", "my", "your", "our",
    "their", "his", "her", "its", "any", "some", "each", "every", "several",
    "many", "few", "all", "both", "no", "other", "another", "such",
}

_LEXICON_LOCK = threading.Lock()
_LEXICON_CACHE: Optional[Dict[str, Any]] = None


def load_pos_lexicon(path: Optional[Path] = None) -> Dict[str, Any]:
    """Load (and cache) the heuristic POS lexicon."""
    global _LEXICON_CACHE
    with _LEXICON_LOCK:
        if _LEXICON_CACHE is not None:
            return _LEXICON_CACHE
        target = Path(path) if path else settings.data_dir / "pos_lexicon.json"
        try:
            raw = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("pos_lexicon_unavailable", extra={"path": str(target), "error": str(exc)})
            raw = {}
        _LEXICON_CACHE = {
            "lexicon": {k.lower(): v for k, v in raw.get("lexicon", {}).items()},
            "irregular": {k.lower(): v.lower() for k, v in raw.get("irregular_lemmas", {}).items()},
            "verb_suffixes": raw.get("verb_suffix_rules", []),
            "noun_suffixes": raw.get("noun_suffix_rules", []),
            "adjective_suffixes": raw.get("adjective_suffix_rules", []),
            "adverb_suffixes": raw.get("adverb_suffix_rules", []),
        }
        logger.info(
            "pos_lexicon_loaded",
            extra={"entries": len(_LEXICON_CACHE["lexicon"]), "path": str(target)},
        )
        return _LEXICON_CACHE


# --------------------------------------------------------------------------- #
# POS tagging
# --------------------------------------------------------------------------- #
class HeuristicPOSTagger:
    """Lexicon + morphology + context POS tagger (universal tagset)."""

    def __init__(self, lexicon: Optional[Dict[str, Any]] = None) -> None:
        data = lexicon or load_pos_lexicon()
        self.lexicon: Dict[str, str] = data["lexicon"]
        self.suffix_rules: List[Tuple[str, str, int, float]] = []
        for group in ("verb_suffixes", "noun_suffixes", "adjective_suffixes", "adverb_suffixes"):
            for rule in data.get(group, []):
                self.suffix_rules.append(
                    (
                        rule["suffix"],
                        rule["tag"],
                        int(rule.get("min_stem", 3)),
                        float(rule.get("confidence", 0.9)),
                    )
                )
        # Longest suffix first so that e.g. "ology" beats "ly".
        self.suffix_rules.sort(key=lambda r: -len(r[0]))

    def tag(self, token: str, *, prev: Optional[str] = None, next_token: Optional[str] = None,
            sentence_index: int = 0) -> Tuple[str, str]:
        """Return ``(universal_pos, fine_tag)`` for a single token."""
        if not token:
            return "X", "FW"
        if token.isspace():
            return "SPACE", "_SP"
        if all(ch in ".,;:!?\"'`()[]{}—–-…/\\|@#$%^&*_+=<>~`" for ch in token):
            return "PUNCT", "." if token in ".!?" else ","
        if _DIGIT_RE.match(token):
            return "NUM", "CD"

        lower = token.lower()

        # 1. Exact lexicon hit ------------------------------------------------ #
        pos = self.lexicon.get(lower)

        # 2. Context overrides ------------------------------------------------ #
        if pos in {"NOUN", "VERB", "ADJ", "PROPN"}:
            prev_lower = (prev or "").lower()
            if pos == "VERB" and prev_lower in _NOUN_TRIGGERS:
                pos = "NOUN"
            elif pos == "NOUN" and prev_lower in _VERB_TRIGGERS:
                pos = "VERB"
        elif pos is None:
            pos = self._infer(lower, token, prev, sentence_index)

        if pos is None:
            pos = "NOUN"

        return pos, self._fine_tag(pos, token, lower)

    # ------------------------------------------------------------------ #
    def _infer(self, lower: str, original: str, prev: Optional[str], index: int) -> Optional[str]:
        """Infer a POS for a token missing from the lexicon."""
        # Acronyms and proper nouns.
        if _ALLCAPS_RE.match(original) and len(original) > 1:
            return "PROPN"
        if index > 0 and original[:1].isupper() and _ACRONYM_RE.match(original):
            # Capitalised mid-sentence -> proper noun unless morphology says otherwise.
            suffix_pos = self._suffix_lookup(lower)
            if suffix_pos in {"NOUN", "ADJ", "VERB", "ADV"} and len(lower) > 6:
                return suffix_pos
            return "PROPN"

        suffix_pos = self._suffix_lookup(lower)
        if suffix_pos:
            return suffix_pos

        # Hyphenated compounds take the tag of their last element.
        if "-" in lower:
            tail = lower.rsplit("-", 1)[-1]
            if tail in self.lexicon:
                return self.lexicon[tail]
            return self._suffix_lookup(tail) or "ADJ"

        # Unknown alpha token in a resume/JD is overwhelmingly a technical noun.
        return "NOUN"

    def _suffix_lookup(self, lower: str) -> Optional[str]:
        for suffix, tag, min_stem, _confidence in self.suffix_rules:
            if lower.endswith(suffix) and len(lower) - len(suffix) >= min_stem:
                return tag
        return None

    def _fine_tag(self, pos: str, token: str, lower: str) -> str:
        base = _TAG_MAP.get(pos, "NN")
        if pos == "NOUN" and (lower.endswith("s") and not lower.endswith("ss")):
            return "NNS"
        if pos == "PROPN":
            return "NNPS" if lower.endswith("s") else "NNP"
        if pos == "VERB":
            if lower.endswith("ing"):
                return "VBG"
            if lower.endswith("ed"):
                return "VBD"
            if lower.endswith("s") and not lower.endswith("ss"):
                return "VBZ"
            return "VB"
        if pos == "ADJ":
            return "JJR" if lower.endswith("er") and len(lower) > 4 else (
                "JJS" if lower.endswith("est") else "JJ"
            )
        if pos == "ADV":
            return "RBR" if lower.endswith("er") else ("RBS" if lower.endswith("est") else "RB")
        return base

    def tag_sequence(self, tokens: Sequence[str]) -> List[Tuple[str, str]]:
        """Tag a whole sequence with left/right context."""
        out: List[Tuple[str, str]] = []
        for idx, token in enumerate(tokens):
            prev = tokens[idx - 1] if idx > 0 else None
            nxt = tokens[idx + 1] if idx + 1 < len(tokens) else None
            out.append(self.tag(token, prev=prev, next_token=nxt, sentence_index=idx))
        return out


# --------------------------------------------------------------------------- #
# Lemmatization
# --------------------------------------------------------------------------- #
class RuleBasedLemmatizer:
    """Irregular-form table + productive suffix stripping lemmatiser."""

    _PLURAL_RULES: Tuple[Tuple[str, str], ...] = (
        ("ies", "y"), ("ves", "f"), ("ses", "s"), ("xes", "x"), ("zes", "z"),
        ("ches", "ch"), ("shes", "sh"), ("oes", "o"), ("sses", "ss"), ("s", ""),
    )
    _VERB_RULES: Tuple[Tuple[str, str], ...] = (
        ("ied", "y"), ("ied", "ie"), ("eed", "ee"), ("ed", ""), ("ed", "e"),
        ("ing", ""), ("ing", "e"),
    )

    def __init__(self, lexicon: Optional[Dict[str, Any]] = None) -> None:
        data = lexicon or load_pos_lexicon()
        self.irregular: Dict[str, str] = data["irregular"]
        self._cache: Dict[Tuple[str, str], str] = {}

    def lemmatize(self, token: str, pos: str = "NOUN") -> str:
        """Return the lemma for ``token`` given its universal POS."""
        if not token:
            return token
        key = (token.lower(), pos)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        lower = token.lower()
        lemma = self.irregular.get(lower, lower)

        if lemma == lower:  # no irregular entry -> apply productive rules
            if pos in {"NOUN", "PROPN"}:
                lemma = self._depluralize(lower)
            elif pos == "VERB":
                lemma = self._deverbalize(lower)
            elif pos == "ADJ":
                lemma = self._deadjectivize(lower)

        # Preserve the surface form of technical/proper terms.
        if token.isupper() or _ACRONYM_RE.match(token):
            lemma = token if token.isupper() else lemma
        self._cache[key] = lemma
        return lemma

    def _depluralize(self, word: str) -> str:
        if len(word) <= 3 or not word.endswith("s"):
            return word
        if word.endswith(("ss", "us", "is", "as", "os")):
            return word
        for suffix, replacement in self._PLURAL_RULES:
            if word.endswith(suffix) and len(word) - len(suffix) >= 2:
                stem = word[: -len(suffix)] + replacement
                # Undo over-eager stripping ("analysis" -> keep, "buses" -> "bus").
                if stem in self.irregular or len(stem) >= 3:
                    return stem
        return word

    def _deverbalize(self, word: str) -> str:
        if len(word) <= 3:
            return word
        if word.endswith("ing") and len(word) > 5:
            stem = word[:-3]
            if stem and stem[-1] == stem[-2: -1] and stem[-1] not in "aeiou":
                stem = stem[:-1]  # running -> run
            return stem if len(stem) >= 3 else word[:-3] + "e"
        if word.endswith("ed") and len(word) > 4:
            stem = word[:-2]
            if stem and stem[-1] == stem[-2: -1] and stem[-1] not in "aeiou":
                stem = stem[:-1]  # stopped -> stop
            if len(stem) >= 3:
                return stem
            return word[:-1] if word.endswith("eed") else stem + "e"
        if word.endswith("s") and not word.endswith(("ss", "us", "is")) and len(word) > 3:
            return word[:-1]
        return word

    def _deadjectivize(self, word: str) -> str:
        if word.endswith(("er", "est")) and len(word) > 5:
            stem = word[:-2] if word.endswith("er") else word[:-3]
            if stem and stem[-1] == stem[-2: -1]:
                stem = stem[:-1]
            return stem if len(stem) >= 3 else word
        return word


# --------------------------------------------------------------------------- #
# Shallow dependency parsing
# --------------------------------------------------------------------------- #
class ShallowDependencyParser:
    """Phrase-structure heuristics that assign ``dep_`` and ``head`` indices.

    Not a real statistical parser, but it produces the relations the rest of
    the system actually consumes: ``ROOT``, ``nsubj``, ``dobj``/``obj``,
    ``pobj``, ``prep``, ``amod``, ``compound``, ``det``, ``aux``, ``advmod``,
    ``cc``, ``conj`` and ``punct`` — which is enough for ``doc.noun_chunks``,
    subject/object extraction and action-verb analysis.
    """

    _PREPOSITIONS = {
        "in", "on", "at", "by", "for", "with", "about", "against", "between",
        "into", "through", "during", "before", "after", "above", "below",
        "from", "up", "down", "out", "off", "over", "under", "across",
        "along", "among", "around", "behind", "beyond", "despite", "except",
        "inside", "near", "onto", "outside", "past", "per", "plus", "than",
        "toward", "towards", "via", "within", "without", "upon", "as", "of",
        "to", "using", "including",
    }

    def parse(self, doc: Doc) -> Doc:
        for sent in doc.sents:
            self._parse_sentence(doc, list(sent))
        return doc

    def _parse_sentence(self, doc: Doc, tokens: List[Any]) -> None:
        if not tokens:
            return
        if len(tokens) == 1:
            tokens[0].dep_ = "ROOT"
            tokens[0].head = tokens[0]
            return

        root_idx = self._find_root(tokens)
        root = tokens[root_idx]
        root.dep_ = "ROOT"
        root.head = root

        subject_done = False
        open_prep: Optional[Any] = None
        conj_head = root

        for idx, token in enumerate(tokens):
            if idx == root_idx:
                open_prep = None
                continue
            pos = token.pos_
            text = token.text.lower()

            # Punctuation always attaches to the root.
            if pos in {"PUNCT", "SPACE"}:
                token.dep_ = "punct"
                token.head = root
                continue

            # Auxiliaries and negation attach to the root verb.
            if pos == "AUX" or text in {"not", "n't"}:
                token.dep_ = "aux" if pos == "AUX" else "neg"
                token.head = root
                continue

            # Determiners / adjectives / nouns before the root form the subject.
            if idx < root_idx:
                if pos in {"NOUN", "PROPN", "PRON"} and not subject_done:
                    token.dep_ = "nsubj"
                    token.head = root
                    subject_done = True
                    conj_head = root
                elif pos in {"NOUN", "PROPN"}:
                    token.dep_ = "compound"
                    token.head = tokens[root_idx - 1] if root_idx else root
                elif pos in {"DET", "ADJ", "NUM"}:
                    token.dep_ = "det" if pos == "DET" else "amod"
                    token.head = self._nearest_right(tokens, idx, {"NOUN", "PROPN"}, root)
                elif pos == "ADP" or text in self._PREPOSITIONS:
                    token.dep_ = "prep"
                    token.head = root
                elif pos == "ADV":
                    token.dep_ = "advmod"
                    token.head = root
                elif pos == "VERB":
                    token.dep_ = "advcl"
                    token.head = root
                else:
                    token.dep_ = "dep"
                    token.head = root
                continue

            # After the root ------------------------------------------------ #
            if pos == "ADP" or text in self._PREPOSITIONS:
                token.dep_ = "prep"
                token.head = root
                open_prep = token
                continue
            if pos == "CCONJ":
                token.dep_ = "cc"
                token.head = conj_head
                continue
            if pos in {"NOUN", "PROPN", "PRON"}:
                if open_prep is not None:
                    token.dep_ = "pobj"
                    token.head = open_prep
                else:
                    token.dep_ = "dobj"
                    token.head = root
                    conj_head = root
                continue
            if pos in {"DET", "ADJ", "NUM"}:
                head = self._nearest_right(tokens, idx, {"NOUN", "PROPN"}, root)
                token.dep_ = "det" if pos == "DET" else ("amod" if pos == "ADJ" else "nummod")
                token.head = head
                if pos == "ADJ":
                    open_prep = None
                continue
            if pos == "ADV":
                token.dep_ = "advmod"
                token.head = root
                continue
            if pos == "VERB":
                token.dep_ = "conj" if open_prep is None else "pcomp"
                token.head = root
                continue
            token.dep_ = "dep"
            token.head = root

    @staticmethod
    def _find_root(tokens: List[Any]) -> int:
        """Main verb = first finite verb; fall back to first noun."""
        for idx, token in enumerate(tokens):
            if token.pos_ == "VERB" and token.tag_ in {"VB", "VBD", "VBZ", "VBP"}:
                return idx
        for idx, token in enumerate(tokens):
            if token.pos_ == "VERB":
                return idx
        for idx, token in enumerate(tokens):
            if token.pos_ in {"NOUN", "PROPN", "PRON", "ADJ", "NUM"}:
                return idx
        return 0

    @staticmethod
    def _nearest_right(tokens: List[Any], idx: int, wanted: set, default: Any) -> Any:
        for nxt in tokens[idx + 1: idx + 4]:
            if nxt.pos_ in wanted:
                return nxt
        return default


# --------------------------------------------------------------------------- #
# spaCy component registration (idempotent)
# --------------------------------------------------------------------------- #
_TAGGER = HeuristicPOSTagger()
_LEMMATIZER = RuleBasedLemmatizer()
_PARSER = ShallowDependencyParser()


def _register(name: str, factory) -> None:
    """Register a spaCy component, tolerating re-imports/reloads."""
    try:
        if Language.has_factory(name):
            return
    except AttributeError:  # pragma: no cover - very old spaCy
        if name in getattr(Language, "factories", {}):
            return
    try:
        Language.component(name, func=factory)
    except (OSError, ValueError) as exc:  # pragma: no cover - race on reload
        logger.debug("component_registration_skipped", extra={"component": name, "error": str(exc)})


def heuristic_tagger(doc: Doc) -> Doc:
    """spaCy component: assign ``pos_``/``tag_`` using the heuristic tagger."""
    tokens = [t.text for t in doc]
    sent_starts = [t.i for t in doc if t.is_sent_start] or [0]
    boundaries = sent_starts + [len(tokens)]
    for start, end in zip(boundaries, boundaries[1:]):
        for offset in range(start, end):
            token = doc[offset]
            if token.is_space or token.is_punct:
                token.pos_ = "PUNCT" if token.is_punct else "SPACE"
                token.tag_ = "." if token.is_punct else "_SP"
                continue
            prev = tokens[offset - 1] if offset > start else None
            nxt = tokens[offset + 1] if offset + 1 < end else None
            pos, tag = _TAGGER.tag(token.text, prev=prev, next_token=nxt, sentence_index=offset - start)
            token.pos_ = pos
            token.tag_ = tag
    return doc


def heuristic_lemmatizer(doc: Doc) -> Doc:
    """spaCy component: assign ``lemma_`` using the rule-based lemmatiser."""
    for token in doc:
        if token.is_space:
            token.lemma_ = token.text
            continue
        pos = token.pos_ or "NOUN"
        token.lemma_ = _LEMMATIZER.lemmatize(token.text, pos)
    return doc


def heuristic_parser(doc: Doc) -> Doc:
    """spaCy component: assign shallow dependency labels."""
    return _PARSER.parse(doc)


_register("heuristic_tagger", heuristic_tagger)
_register("heuristic_lemmatizer", heuristic_lemmatizer)
_register("heuristic_parser", heuristic_parser)


# --------------------------------------------------------------------------- #
# Pipeline factory
# --------------------------------------------------------------------------- #
def build_offline_nlp(
    entity_patterns: Optional[Iterable[Dict[str, Any]]] = None,
    max_length: Optional[int] = None,
) -> Language:
    """Build a fully offline spaCy pipeline.

    Parameters
    ----------
    entity_patterns:
        Optional EntityRuler patterns (skills, gazetteers, degrees, ...).
    max_length:
        spaCy ``nlp.max_length`` guard for very large documents.
    """
    nlp = spacy.blank("en")
    nlp.max_length = max_length or settings.spacy_max_length
    nlp.add_pipe("sentencizer")
    nlp.add_pipe("heuristic_tagger")
    nlp.add_pipe("heuristic_lemmatizer")
    nlp.add_pipe("heuristic_parser")
    if entity_patterns:
        ruler = nlp.add_pipe("entity_ruler", config={"overwrite_ents": True, "validate": False})
        patterns = list(entity_patterns)
        # EntityRuler.add_patterns is O(n); batch it to keep startup fast.
        ruler.add_patterns(patterns)
        logger.info("entity_ruler_loaded", extra={"patterns": len(patterns)})
    logger.info(
        "offline_pipeline_built",
        extra={"components": nlp.pipe_names, "patterns": len(list(entity_patterns or []))},
    )
    return nlp


def merge_entity_spans(doc: Doc, extra_spans: Iterable[Any]) -> List[Any]:
    """Merge manual spans with model spans, dropping overlaps (longest wins)."""
    combined = list(doc.ents) + list(extra_spans)
    return list(filter_spans(combined))


__all__ = [
    "HeuristicPOSTagger",
    "RuleBasedLemmatizer",
    "ShallowDependencyParser",
    "build_offline_nlp",
    "heuristic_tagger",
    "heuristic_lemmatizer",
    "heuristic_parser",
    "load_pos_lexicon",
    "merge_entity_spans",
]
