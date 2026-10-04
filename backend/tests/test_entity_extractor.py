"""Tests for stage 7 — named entity extraction."""

from __future__ import annotations

import pytest

from core.entity_extractor import EntityExtractor, skill_surface_policy
from models.schemas import JobDescriptionEntities, ResumeEntities


class TestResumeEntities:
    def test_extracts_person(self, resume_entities: ResumeEntities):
        assert resume_entities.person == "John Doe"

    def test_extracts_contact_details(self, resume_entities: ResumeEntities):
        assert "john.doe@example.com" in resume_entities.emails
        assert resume_entities.phones
        assert any("linkedin" in url for url in resume_entities.urls)
        assert any("github" in url for url in resume_entities.urls)

    def test_extracts_locations(self, resume_entities: ResumeEntities):
        assert any("san francisco" in loc.lower() for loc in resume_entities.locations)

    def test_extracts_organizations(self, resume_entities: ResumeEntities):
        joined = " ".join(resume_entities.organizations).lower()
        assert "google" in joined or "stanford" in joined

    def test_extracts_job_titles(self, resume_entities: ResumeEntities):
        titles = [title.lower() for title in resume_entities.job_titles]
        assert "senior machine learning engineer" in titles
        assert "machine learning engineer" in titles

    def test_dates_are_collected(self, resume_entities: ResumeEntities):
        assert any("2021" in date for date in resume_entities.dates)
        assert any("present" in date.lower() for date in resume_entities.dates)

    def test_years_experience_ignores_education_dates(self, resume_entities: ResumeEntities):
        """Regression: "2012 - 2016" at Stanford inflated experience to 14.4 yrs."""
        assert resume_entities.years_experience is not None
        assert 7.0 <= resume_entities.years_experience < 10.0

    def test_degrees_and_education_level(self, resume_entities: ResumeEntities):
        assert resume_entities.education_level == "master"
        joined = " ".join(resume_entities.degrees).lower()
        assert "m.s. in computer science" in joined
        assert "b.s. in mathematics" in joined
        # Regression: "_prettify_degree" used to emit "M.s.".
        assert all(degree == degree.replace("M.s.", "M.S.") for degree in resume_entities.degrees)

    def test_certifications(self, resume_entities: ResumeEntities):
        assert any("aws" in cert.lower() for cert in resume_entities.certifications)

    def test_skills_are_taxonomy_terms_not_raw_spans(self, resume_entities: ResumeEntities):
        """Regression: raw NER leaked job titles and degree fields into skills."""
        skills = {skill.lower() for skill in resume_entities.skills}
        assert "machine learning" in skills
        assert "python" in skills
        for banned in (
            "senior machine learning engineer",
            "machine learning engineer",
            "computer science",
            "senior ml engineer",
        ):
            assert banned not in skills, banned

    def test_compound_skills_survive(self, resume_entities: ResumeEntities):
        skills = {skill.lower() for skill in resume_entities.skills}
        assert "ci/cd" in skills or "scikit-learn" in skills


class TestJobDescriptionEntities:
    def test_extracts_org_and_title(self, jd_entities: JobDescriptionEntities):
        assert jd_entities.organization == "TechCorp"
        assert "machine learning engineer" in (jd_entities.job_title or "").lower()

    def test_min_years_experience(self, jd_entities: JobDescriptionEntities):
        assert jd_entities.min_years_experience == 5

    @pytest.mark.parametrize(
        "text,expected",
        [
            ("5+ years of experience", 5),
            ("We require a minimum of 3 years of experience with Python.", 3),
            ("10+ years building systems; extensive experience required.", 10),
            ("At least 2 years of professional experience.", 2),
            ("No requirement stated here.", None),
            # A bare number with no experience context must not be picked up.
            ("Our team of 12 engineers ships weekly.", None),
        ],
    )
    def test_min_years_parsing(self, entity_extractor: EntityExtractor, text: str, expected):
        assert entity_extractor.extract_min_years(text) == expected

    def test_degree_requirement(self, jd_entities: JobDescriptionEntities):
        assert jd_entities.degree_requirement
        assert "computer science" in jd_entities.degree_requirement.lower()

    def test_experience_requirement_text(self, jd_entities: JobDescriptionEntities):
        assert jd_entities.experience_requirement == "5+ years"

    def test_required_and_preferred_skills_are_separate(self, jd_entities: JobDescriptionEntities):
        assert jd_entities.required_skills
        assert jd_entities.preferred_skills
        assert "go" in {skill.lower() for skill in jd_entities.preferred_skills}
        assert "python" in {skill.lower() for skill in jd_entities.required_skills}

    def test_preferred_is_not_just_a_copy_of_required(self, jd_entities: JobDescriptionEntities):
        """Regression: preferred_skills used to mirror the whole skill list."""
        preferred = {skill.lower() for skill in jd_entities.preferred_skills}
        required = {skill.lower() for skill in jd_entities.required_skills}
        assert preferred != required

    def test_soft_skills(self, jd_entities: JobDescriptionEntities):
        assert {skill.lower() for skill in jd_entities.soft_skills} >= {
            "leadership", "communication", "collaboration"
        }

    def test_salary_range_survives_cleaning(self, jd_entities: JobDescriptionEntities):
        """Regression: the cleaner stripped "$", so salary was always None."""
        assert jd_entities.salary_range == "$180,000 - $230,000"

    def test_location(self, jd_entities: JobDescriptionEntities):
        assert jd_entities.location == "Remote (US)"


class TestSkillExtraction:
    def test_aliases_are_canonicalised(self, entity_extractor: EntityExtractor):
        skills = entity_extractor.extract_skills(
            "Expert in scikit learn, pytorch, k8s, Postgres and javascript."
        )
        lowered = {skill.lower() for skill in skills}
        assert "scikit-learn" in lowered
        assert "kubernetes" in lowered
        assert "postgresql" in lowered

    def test_case_insensitive_dedup(self, entity_extractor: EntityExtractor):
        skills = entity_extractor.extract_skills("Python python PYTHON and Docker docker")
        assert len(skills) == len({skill.lower() for skill in skills})

    @pytest.mark.parametrize(
        "surface,expected",
        [
            ("go", "exact"),      # only matches when written as "Go"
            ("docker", "exact"),
            ("next", "drop"),     # Next.js is covered by "next.js"/"nextjs"
            ("spring", "drop"),
            ("golang", "any"),
            ("python", "any"),
            ("sql", "any"),
            ("", "drop"),
        ],
    )
    def test_ambiguous_surface_policy(self, surface: str, expected: str):
        """Policy decides *how* an alias may match: drop / exact / any."""
        assert skill_surface_policy(surface) == expected

    def test_prose_words_are_not_extracted_as_skills(self, entity_extractor: EntityExtractor):
        skills = {skill.lower() for skill in entity_extractor.extract_skills(
            "I go to the gym and have no objections, or so I thought."
        )}
        assert not skills & {"go", "no", "or"}

    def test_uppercase_go_is_extracted(self, entity_extractor: EntityExtractor):
        skills = {skill.lower() for skill in entity_extractor.extract_skills(
            "Backend services written in Go and Rust."
        )}
        assert "go" in skills

    def test_extract_skills_from_empty_text(self, entity_extractor: EntityExtractor):
        assert entity_extractor.extract_skills("") == []

    def test_extract_skills_with_categories(self, entity_extractor: EntityExtractor):
        grouped = entity_extractor.extract_skills_with_categories("Python, TensorFlow, AWS, SQL")
        assert isinstance(grouped, dict)
        assert grouped

    def test_canonicalize_skill(self, entity_extractor: EntityExtractor):
        assert entity_extractor.canonicalize_skill("k8s") == "Kubernetes"
        assert entity_extractor.canonicalize_skill("pytorch") == "PyTorch"
        # Unknown surfaces are echoed back unchanged (the caller decides).
        assert entity_extractor.canonicalize_skill("not-a-real-skill-xyz") == "not-a-real-skill-xyz"

    def test_skill_category(self, entity_extractor: EntityExtractor):
        assert entity_extractor.skill_category("Python")
        assert entity_extractor.skill_category("Kubernetes")

    def test_extract_certifications(self, entity_extractor: EntityExtractor):
        certs = entity_extractor.extract_certifications(
            "Certifications:\n- AWS Certified Solutions Architect\n- CKA"
        )
        assert any("aws" in cert.lower() for cert in certs)

    def test_extract_dates_finds_ranges_and_singles(self, entity_extractor: EntityExtractor):
        assert entity_extractor.extract_dates("Jan 2021 - Present, also 2019 and March 2020.")

    def test_extract_degrees(self, entity_extractor: EntityExtractor):
        degrees = entity_extractor.extract_degrees("M.S. in Computer Science, B.S. in Mathematics")
        assert degrees

    @pytest.mark.parametrize(
        "degrees,expected",
        [
            (["Ph.D. in Physics"], "phd"),
            (["M.S. in Computer Science"], "master"),
            (["B.S. in CS"], "bachelor"),
            (["Associate of Arts"], "associate"),
            ([], None),
        ],
    )
    def test_extract_education_level(self, entity_extractor: EntityExtractor, degrees, expected):
        assert entity_extractor.extract_education_level(degrees) == expected


class TestYearsExperience:
    @pytest.mark.parametrize(
        "text,expected_min,expected_max",
        [
            ("8+ years of experience building ML systems.", 8, 9),
            ("12 years of clinical practice.", 12, 13),
            ("3 years with Kubernetes.", 3, 4),
        ],
    )
    def test_explicit_year_mentions(self, entity_extractor: EntityExtractor, text, expected_min, expected_max):
        years = entity_extractor.compute_years_experience(text)
        assert years is not None
        assert expected_min <= years <= expected_max

    def test_spelled_out_numbers_are_not_parsed(self, entity_extractor: EntityExtractor):
        """Documented limitation: only digits and date ranges are understood."""
        assert entity_extractor.compute_years_experience("Ten years in the industry.") is None

    def test_nothing_found(self, entity_extractor: EntityExtractor):
        assert entity_extractor.compute_years_experience("Loves hiking and coffee.") is None

    def test_caps_implausible_values(self, entity_extractor: EntityExtractor):
        text = "1980 - 1985\n1985 - 1990\n1990 - 1995\n1995 - 2000\n2000 - 2005\n2005 - 2010"
        years = entity_extractor.compute_years_experience(text)
        assert years is None or years <= 60

    def test_exclude_text_removes_spans(self, entity_extractor: EntityExtractor):
        resume = "Jan 2016 - Dec 2024 DataScale Inc.\n2012 - 2016 Stanford University M.S."
        education = "2012 - 2016 Stanford University M.S."
        with_exclude = entity_extractor.compute_years_experience(resume, exclude_text=education)
        without = entity_extractor.compute_years_experience(resume)
        assert (with_exclude or 0) <= (without or 0)

    def test_date_range_span_is_converted_to_years(self, entity_extractor: EntityExtractor):
        years = entity_extractor.compute_years_experience("Jan 2020 - Dec 2022 Senior Engineer")
        assert years is not None
        assert 2.5 <= years <= 3.5


class TestEntityExtractorConstruction:
    def test_extractor_can_be_built_without_a_pipeline(self):
        extractor = EntityExtractor()
        assert extractor.extract_skills("Python and Docker")

    def test_module_singleton_factory(self):
        from core.entity_extractor import get_entity_extractor

        assert isinstance(get_entity_extractor(), EntityExtractor)
