"""Tests for the model registry, JSON data loading and warm-up behaviour."""

from __future__ import annotations

import pytest

from config import DATA_DIR, settings
from services.cache_service import ModelRegistry, load_json, model_registry


def _pattern_text(entry: dict) -> str:
    """Flatten an EntityRuler pattern to its literal text (best effort)."""
    pattern = entry.get("pattern")
    if isinstance(pattern, str):
        return pattern
    if isinstance(pattern, list):
        return " ".join(
            str(step.get("LOWER", step.get("TEXT", step.get("ORTH", "")))) for step in pattern
        )
    return str(pattern)


class TestDataFiles:
    @pytest.mark.parametrize(
        "filename",
        ["skill_taxonomy.json", "industry_keywords.json", "stop_words_extended.json",
         "pos_lexicon.json", "gazetteers.json"],
    )
    def test_every_data_file_loads(self, filename: str):
        payload = load_json(DATA_DIR / filename, {})
        assert payload, filename

    def test_missing_file_returns_the_default(self, tmp_path):
        assert load_json(tmp_path / "nope.json", {"fallback": True}) == {"fallback": True}

    def test_skill_taxonomy_is_categorised(self):
        taxonomy = load_json(settings.skill_taxonomy_path, {})
        assert isinstance(taxonomy, dict) and taxonomy
        for category, skills in taxonomy.items():
            assert isinstance(category, str)
            assert isinstance(skills, dict) and skills
            for canonical, aliases in skills.items():
                assert canonical
                assert isinstance(aliases, list)
                assert all(isinstance(alias, str) for alias in aliases)

    def test_every_alias_is_unique_across_the_taxonomy(self):
        """An alias pointing at two skills would make matching non-deterministic."""
        taxonomy = load_json(settings.skill_taxonomy_path, {})
        seen: dict[str, str] = {}
        duplicates = []
        for _category, skills in taxonomy.items():
            for canonical, aliases in skills.items():
                for alias in list(aliases) + [canonical.lower()]:
                    key = alias.strip().lower()
                    if key in seen and seen[key] != canonical:
                        duplicates.append((key, seen[key], canonical))
                    seen[key] = canonical
        assert not duplicates, f"ambiguous aliases: {duplicates[:10]}"

    def test_gazetteers_have_the_expected_collections(self):
        gazetteers = load_json(DATA_DIR / "gazetteers.json", {})
        for key in ("certifications", "degrees", "job_titles", "locations", "organizations", "universities"):
            assert key in gazetteers, key
            assert gazetteers[key]


class TestRegistryProperties:
    def test_shared_registry_is_a_model_registry(self):
        assert isinstance(model_registry, ModelRegistry)

    def test_json_properties_are_cached_and_typed(self):
        registry = ModelRegistry()
        assert isinstance(registry.skill_taxonomy, dict)
        assert isinstance(registry.gazetteers, dict)
        assert isinstance(registry.industry_keywords, dict)
        assert isinstance(registry.stop_words_data, dict)
        # Second access returns the very same object (cached, not re-read).
        assert registry.skill_taxonomy is registry.skill_taxonomy

    def test_entity_patterns_are_prepared_for_the_ruler(self):
        patterns = ModelRegistry().entity_patterns()
        assert isinstance(patterns, list) and patterns
        for pattern in patterns[:50]:
            assert {"label", "pattern"} <= set(pattern)
            assert isinstance(pattern["label"], str) and pattern["label"]

    def test_ambiguous_aliases_are_case_sensitive_in_the_ruler(self):
        """`go`/`rust`/`spark` must only match their capitalised form."""
        patterns = ModelRegistry().entity_patterns()
        go_patterns = [entry for entry in patterns
                       if entry.get("label") == "SKILL" and _pattern_text(entry).split() == ["Go"]]
        assert go_patterns, "the EntityRuler has no case-sensitive 'Go' pattern"

    def test_status_reports_every_model(self):
        status = model_registry.status()
        assert "spacy" in status
        assert "sentence_transformer" in status
        for model in status.values():
            assert model.name
            assert model.variant in {"statistical", "heuristic", "transformer", "lsa", "lsa_fallback", ""}

    def test_models_used_is_a_list_of_strings(self):
        used = model_registry.models_used()
        assert isinstance(used, list)
        assert all(isinstance(name, str) for name in used)

    def test_degraded_is_a_bool_property(self):
        """Regression: `is_warm`/`degraded` are properties, not methods."""
        assert isinstance(model_registry.degraded, bool)
        assert isinstance(model_registry.is_warm, bool)


class TestModelLoading:
    def test_get_nlp_returns_a_usable_pipeline(self):
        nlp = model_registry.get_nlp()
        assert nlp is not None
        doc = nlp("Senior machine learning engineer at TechCorp in San Francisco.")
        assert [token.text for token in doc]

    def test_nlp_is_cached_between_calls(self):
        assert model_registry.get_nlp() is model_registry.get_nlp()

    def test_offline_variant_is_reported_honestly(self):
        """Without downloadable weights the registry must say so."""
        status = model_registry.status()["spacy"]
        assert status.loaded is True
        assert status.variant in {"statistical", "heuristic"}

    def test_encoder_is_none_or_a_real_model(self):
        encoder = model_registry.get_encoder()
        if encoder is None:
            assert model_registry.status()["sentence_transformer"].loaded is False
            assert model_registry.status()["sentence_transformer"].error

    def test_reset_drops_cached_models(self):
        registry = ModelRegistry()
        registry.get_nlp()
        registry.reset()
        assert registry.is_warm is False
        # …and they are rebuilt on demand.
        assert registry.get_nlp() is not None

    def test_warm_up_is_idempotent(self):
        registry = ModelRegistry()
        registry.warm_up(background=False)
        registry.warm_up(background=False)
        assert registry.is_warm is True
