"""Stage 14 — report generation: recommendations and the ATS check.

Two responsibilities:

* :meth:`ReportGenerator.generate_recommendations` converts every finding
  (missing skills, keyword gaps, weak sections, experience/education shortfalls,
  terminology mismatches, formatting problems) into prioritised, actionable
  advice with a concrete ``action`` the candidate can take.
* :meth:`ReportGenerator.generate_ats_check` scores how parseable the document
  is for a real Applicant Tracking System — the checks recruiters actually run
  (text extractability, tables, images, headers, contact info, length, columns,
  keyword stuffing).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from config import settings
from models.schemas import (
    ATSCheck,
    ATSIssue,
    GapAnalysisResult,
    IssueSeverity,
    KeywordAnalysis,
    NLPMetadata,
    Priority,
    Recommendation,
    ResumeEntities,
    JobDescriptionEntities,
    ScoreBreakdown,
    SectionScore,
    SkillMatchResult,
    ExtractedText,
)
from utils.logger import get_logger
from utils.text_utils import clamp

logger = get_logger(__name__)

EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF\U00002190-\U000021FF"
    "\U00002B00-\U00002BFF\U0000FE00-\U0000FE0F\U0001F1E6-\U0001F1FF]"
)
NON_ASCII_RE = re.compile(r"[^\x00-\x7F]")
COLUMN_GAP_RE = re.compile(r"\S {4,}\S")
BULLET_RE = re.compile(r"(?m)^\s*(?:[•·*\-–—]|\d+[.)])\s+")
DATE_LINE_RE = re.compile(
    r"(?i)\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*(?:19|20)\d{2}"
    r"|\b(?:19|20)\d{2}\s*(?:-|–|—)\s*(?:present|current|now|(?:19|20)\d{2})"
)

#: Sections that carry no matching signal and are excluded from section scores.
NON_CONTENT_SECTIONS = {"contact", "references", "unstructured"}

PRIORITY_ORDER = {Priority.HIGH: 0, Priority.MEDIUM: 1, Priority.LOW: 2}


class ReportGenerator:
    """Produces recommendations and the ATS compatibility report."""

    # ------------------------------------------------------------------ #
    # Recommendations
    # ------------------------------------------------------------------ #
    def generate_recommendations(
        self,
        *,
        gap_analysis: GapAnalysisResult,
        breakdown: ScoreBreakdown,
        skill_match: SkillMatchResult,
        keyword_analysis: KeywordAnalysis,
        section_scores: Dict[str, SectionScore],
        ats_check: ATSCheck,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        metadata: Optional[NLPMetadata] = None,
        quantified_achievements: int = 0,
        action_verbs: Sequence[str] = (),
        limit: int = 14,
    ) -> List[Recommendation]:
        """Build a prioritised, de-duplicated recommendation list."""
        recs: List[Recommendation] = []

        recs.extend(self._missing_skill_recs(gap_analysis, skill_match, jd_entities))
        recs.extend(self._missing_keyword_recs(gap_analysis, keyword_analysis))
        recs.extend(self._terminology_recs(gap_analysis))
        recs.extend(self._experience_recs(gap_analysis, resume_entities, jd_entities, quantified_achievements))
        recs.extend(self._education_recs(gap_analysis, resume_entities, jd_entities))
        recs.extend(self._section_recs(gap_analysis, section_scores, skill_match))
        recs.extend(self._dimension_recs(breakdown))
        recs.extend(self._ats_recs(ats_check))
        recs.extend(self._density_recs(keyword_analysis))
        recs.extend(self._extraction_recs(metadata))

        recs = self._deduplicate(recs)
        recs.sort(key=lambda r: (PRIORITY_ORDER.get(r.priority, 3), -r.impact_score))
        return recs[:limit]

    # -- individual rule groups ----------------------------------------- #
    def _missing_skill_recs(
        self,
        gap: GapAnalysisResult,
        skill_match: SkillMatchResult,
        jd_entities: JobDescriptionEntities,
    ) -> List[Recommendation]:
        out: List[Recommendation] = []
        high = [s for s in gap.missing_skills if s.importance == "high"]
        medium = [s for s in gap.missing_skills if s.importance == "medium"]
        low = [s for s in gap.missing_skills if s.importance == "low"]

        if high:
            names = ", ".join(f"'{s.skill}'" for s in high[:5])
            mentions = max((s.mentioned_in_jd for s in high), default=1)
            out.append(
                Recommendation(
                    priority=Priority.HIGH,
                    category="missing_skills",
                    message=(
                        f"{len(high)} required skill(s) are missing from your resume: {names}."
                    ),
                    action=(
                        f"Add {names} to your skills section and back them with a concrete "
                        f"bullet in your experience (they appear up to {mentions}x in this posting). "
                        "Only list skills you can genuinely discuss in an interview."
                    ),
                    impact_score=round(90.0 + min(9.0, len(high)), 2),
                )
            )
        if medium:
            names = ", ".join(f"'{s.skill}'" for s in medium[:4])
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="missing_skills",
                    message=f"{len(medium)} expected skill(s) are not mentioned: {names}.",
                    action=(
                        f"Weave {names} into an experience bullet or your skills section using the "
                        "same wording the job description uses."
                    ),
                    impact_score=round(60.0 + min(9.0, len(medium)), 2),
                )
            )
        if low:
            names = ", ".join(f"'{s.skill}'" for s in low[:4])
            out.append(
                Recommendation(
                    priority=Priority.LOW,
                    category="nice_to_have_skills",
                    message=f"Preferred (not required) skills you could add: {names}.",
                    action=(
                        "These are bonus points in the posting. Mention them only if you have "
                        "real exposure — a short project line is enough."
                    ),
                    impact_score=35.0,
                )
            )
        if skill_match.extra and len(skill_match.extra) > max(6, len(skill_match.matched)):
            out.append(
                Recommendation(
                    priority=Priority.LOW,
                    category="skill_focus",
                    message=(
                        f"{len(skill_match.extra)} of your listed skills are not relevant to this "
                        "posting (e.g. " + ", ".join(skill_match.extra[:4]) + ")."
                    ),
                    action=(
                        "Trim unrelated skills so the required ones stand out; keep the resume "
                        "tailored per application rather than generic."
                    ),
                    impact_score=25.0,
                )
            )
        return out

    def _missing_keyword_recs(
        self, gap: GapAnalysisResult, keyword_analysis: KeywordAnalysis
    ) -> List[Recommendation]:
        high = [k for k in gap.missing_keywords if k.severity == Priority.HIGH]
        medium = [k for k in gap.missing_keywords if k.severity == Priority.MEDIUM]
        out: List[Recommendation] = []
        if high:
            names = ", ".join(f"'{k.keyword}'" for k in high[:5])
            out.append(
                Recommendation(
                    priority=Priority.HIGH,
                    category="keyword_optimization",
                    message=f"High-weight job-description keywords are absent: {names}.",
                    action=(
                        f"Use the exact phrases {names} where they truthfully apply — ATS keyword "
                        "filters match literal wording, so synonyms often score zero."
                    ),
                    impact_score=round(80.0 + min(10.0, len(high)), 2),
                )
            )
        if medium:
            names = ", ".join(f"'{k.keyword}'" for k in medium[:5])
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="keyword_optimization",
                    message=f"Several mid-weight keywords are missing: {names}.",
                    action=(
                        "Add these phrases naturally to your summary or experience bullets; "
                        "one mention each is enough for TF-IDF to register them."
                    ),
                    impact_score=round(55.0 + min(8.0, len(medium)), 2),
                )
            )
        if gap.coverage_ratio < 0.35 and keyword_analysis.top_jd_keywords:
            out.append(
                Recommendation(
                    priority=Priority.HIGH,
                    category="overall_alignment",
                    message=(
                        f"Only {gap.coverage_ratio * 100:.0f}% of the posting's top keywords appear "
                        "in your resume."
                    ),
                    action=(
                        "Rewrite your summary and the most recent role using the posting's own "
                        "vocabulary — mirror its job title, tools and responsibilities."
                    ),
                    impact_score=85.0,
                )
            )
        return out

    def _terminology_recs(self, gap: GapAnalysisResult) -> List[Recommendation]:
        mismatches = [m for m in gap.terminology_mismatches if m.similarity < 0.98]
        if not mismatches:
            return []
        examples = "; ".join(
            f"'{m.resume}' -> '{m.jd}'" for m in mismatches[:3]
        )
        return [
            Recommendation(
                priority=Priority.MEDIUM,
                category="terminology",
                message=f"{len(mismatches)} near-miss term(s) detected ({examples}).",
                action=(
                    "Replace your wording with the job description's exact terminology — "
                    "many ATS keyword filters do not resolve synonyms."
                ),
                impact_score=round(48.0 + min(10.0, len(mismatches) * 2), 2),
            )
        ]

    def _experience_recs(
        self,
        gap: GapAnalysisResult,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
        quantified_achievements: int,
    ) -> List[Recommendation]:
        out: List[Recommendation] = []
        if gap.experience_gap:
            out.append(
                Recommendation(
                    priority=Priority.HIGH,
                    category="experience",
                    message=gap.experience_gap,
                    action=(
                        "Make every relevant role visible with explicit start/end dates "
                        "(Month YYYY - Month YYYY). Include internships, contract and freelance "
                        "work, and state total years in your summary if it meets the bar."
                    ),
                    impact_score=78.0,
                )
            )
        elif resume_entities.years_experience is None:
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="experience",
                    message="No employment dates could be parsed from the resume.",
                    action=(
                        "Use a standard date format such as 'Jan 2019 - Present' for each role; "
                        "unparseable dates make ATS experience filters score you at zero."
                    ),
                    impact_score=60.0,
                )
            )
        if quantified_achievements < 3:
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="impact",
                    message=f"Only {quantified_achievements} quantified achievement(s) detected.",
                    action=(
                        "Convert responsibilities into results with numbers: 'reduced inference "
                        "latency 40%', 'served 2M users', '$180k annual savings'. Aim for 3-6 "
                        "measurable bullets."
                    ),
                    impact_score=round(52.0 + max(0.0, (3 - quantified_achievements)) * 4, 2),
                )
            )
        return out

    def _education_recs(
        self,
        gap: GapAnalysisResult,
        resume_entities: ResumeEntities,
        jd_entities: JobDescriptionEntities,
    ) -> List[Recommendation]:
        out: List[Recommendation] = []
        if gap.education_gap:
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="education",
                    message=gap.education_gap,
                    action=(
                        "List your highest qualification explicitly (degree, field, institution, "
                        "year). If you are close to the requirement, add in-progress coursework, "
                        "certifications or equivalent experience and say so in your summary."
                    ),
                    impact_score=58.0,
                )
            )
        if not resume_entities.degrees and not resume_entities.certifications:
            out.append(
                Recommendation(
                    priority=Priority.LOW,
                    category="education",
                    message="Neither a degree nor a certification was detected.",
                    action=(
                        "Add an Education section, and list relevant certifications — they are "
                        "strong ATS keyword carriers."
                    ),
                    impact_score=38.0,
                )
            )
        elif jd_entities.certifications and not resume_entities.certifications:
            names = ", ".join(jd_entities.certifications[:3])
            out.append(
                Recommendation(
                    priority=Priority.LOW,
                    category="certifications",
                    message=f"The posting references certifications you do not list ({names}).",
                    action=(
                        "If you hold any of these, add a Certifications section with the exact "
                        "certification name and year."
                    ),
                    impact_score=34.0,
                )
            )
        return out

    def _section_recs(
        self,
        gap: GapAnalysisResult,
        section_scores: Dict[str, SectionScore],
        skill_match: SkillMatchResult,
    ) -> List[Recommendation]:
        out: List[Recommendation] = []
        for weak in gap.weak_sections[:4]:
            priority = Priority.HIGH if weak.score < 30 else Priority.MEDIUM if weak.score < 55 else Priority.LOW
            out.append(
                Recommendation(
                    priority=priority,
                    category="section_improvement",
                    message=(
                        f"'{weak.section.title()}' section scores {weak.score:.0f}/100 — {weak.issue}"
                    ),
                    action=weak.suggestion or "Expand and re-target this section to the role.",
                    impact_score=round(clamp(70.0 - weak.score * 0.5, 20.0, 70.0), 2),
                )
            )

        summary = section_scores.get("summary")
        if summary is not None and not summary.present:
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="formatting",
                    message="No professional summary section was detected.",
                    action=(
                        "Add a 'Professional Summary' at the top: target job title, years of "
                        "experience, and 3-4 of the posting's core skills."
                    ),
                    impact_score=50.0,
                )
            )
        return out

    def _dimension_recs(self, breakdown: ScoreBreakdown) -> List[Recommendation]:
        out: List[Recommendation] = []
        weakest = min(
            (
                ("keyword_match", breakdown.keyword_match),
                ("semantic_similarity", breakdown.semantic_similarity),
                ("skill_match", breakdown.skill_match),
                ("experience_relevance", breakdown.experience_relevance),
                ("education_match", breakdown.education_match),
            ),
            key=lambda item: item[1].score,
        )
        name, component = weakest
        if component.score >= 70:
            return out

        guidance = {
            "keyword_match": (
                "Keyword coverage is your weakest dimension.",
                "Mirror the posting's exact terminology for tools, methods and responsibilities "
                "in your summary and most recent role.",
            ),
            "semantic_similarity": (
                "Your resume talks about different topics than the posting.",
                "Rewrite two or three bullets so they describe the same problems and outcomes "
                "the job description emphasises.",
            ),
            "skill_match": (
                "Skill coverage is your weakest dimension.",
                "Add the required technologies you genuinely know, and remove unrelated ones so "
                "the match ratio improves.",
            ),
            "experience_relevance": (
                "Experience alignment is your weakest dimension.",
                "Make dates explicit, use the posting's job title in your summary, and lead each "
                "role with the responsibilities it asks for.",
            ),
            "education_match": (
                "Education alignment is your weakest dimension.",
                "State your degree, field and institution clearly; add equivalent coursework or "
                "certifications if your formal education differs.",
            ),
        }
        message, action = guidance[name]
        return [
            Recommendation(
                priority=Priority.MEDIUM if component.score >= 45 else Priority.HIGH,
                category="score_dimension",
                message=f"{message} ({component.score:.0f}/100, weight {component.weight:.0%}).",
                action=action,
                impact_score=round(clamp(75.0 - component.score * 0.4, 25.0, 75.0), 2),
            )
        ]

    def _ats_recs(self, ats_check: ATSCheck) -> List[Recommendation]:
        out: List[Recommendation] = []
        for issue in ats_check.issues:
            if issue.type not in {IssueSeverity.ERROR, IssueSeverity.WARNING}:
                continue
            out.append(
                Recommendation(
                    priority=Priority.HIGH if issue.type == IssueSeverity.ERROR else Priority.LOW,
                    category="ats_formatting",
                    message=issue.message,
                    action=issue.fix or "Reformat the document for ATS compatibility.",
                    impact_score=60.0 if issue.type == IssueSeverity.ERROR else 30.0,
                )
            )
        return out

    def _density_recs(self, keyword_analysis: KeywordAnalysis) -> List[Recommendation]:
        density = keyword_analysis.keyword_density
        if density.resume_status == "over_optimized":
            return [
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="keyword_stuffing",
                    message=(
                        f"Keyword density is {density.resume:.1%}, which reads as keyword stuffing."
                    ),
                    action=(
                        "Reduce repetition: keep each keyword to 2-4 natural mentions and let "
                        "context (projects, outcomes) carry the rest."
                    ),
                    impact_score=44.0,
                )
            ]
        if density.resume_status == "under_optimized":
            return [
                Recommendation(
                    priority=Priority.LOW,
                    category="keyword_density",
                    message=f"Keyword density is low ({density.resume:.1%}).",
                    action=(
                        "Repeat the posting's core terms 2-3 times each across summary, skills "
                        "and experience so TF-IDF picks them up."
                    ),
                    impact_score=28.0,
                )
            ]
        return []

    def _extraction_recs(self, metadata: Optional[NLPMetadata]) -> List[Recommendation]:
        if metadata is None:
            return []
        out: List[Recommendation] = []
        if metadata.resume_is_scanned:
            out.append(
                Recommendation(
                    priority=Priority.HIGH,
                    category="ats_formatting",
                    message="Your resume needed OCR to be read — it is an image-based document.",
                    action=(
                        "Export a text-based PDF from your word processor. Most ATS parsers "
                        "cannot read scanned or image-only resumes at all."
                    ),
                    impact_score=88.0,
                )
            )
        if metadata.resume_word_count and metadata.resume_word_count < 250:
            out.append(
                Recommendation(
                    priority=Priority.MEDIUM,
                    category="content_depth",
                    message=f"Your resume contains only {metadata.resume_word_count} words.",
                    action=(
                        "Expand experience bullets with tools, scope and outcomes — very short "
                        "resumes give keyword matchers too little signal."
                    ),
                    impact_score=46.0,
                )
            )
        if metadata.resume_word_count > 1400:
            out.append(
                Recommendation(
                    priority=Priority.LOW,
                    category="content_depth",
                    message=f"Your resume is long ({metadata.resume_word_count} words).",
                    action=(
                        "Trim to the last 10 years and the most relevant projects; 500-900 words "
                        "is the sweet spot for both ATS and human reviewers."
                    ),
                    impact_score=22.0,
                )
            )
        return out

    @staticmethod
    def _deduplicate(recs: Sequence[Recommendation]) -> List[Recommendation]:
        seen: set[str] = set()
        seen_messages: set[str] = set()
        unique: List[Recommendation] = []
        for rec in recs:
            key = f"{rec.category}:{rec.message[:60].lower()}"
            # The same sentence surfaced by two categories is still noise.
            message_key = " ".join(rec.message.lower().split())[:80]
            if key in seen or message_key in seen_messages:
                continue
            seen.add(key)
            seen_messages.add(message_key)
            unique.append(rec)
        return list(unique)

    # ------------------------------------------------------------------ #
    # ATS formatting check
    # ------------------------------------------------------------------ #
    def generate_ats_check(
        self,
        *,
        raw_text: str,
        extracted: ExtractedText,
        sections: Sequence[str] = (),
        emails: Sequence[str] = (),
        phones: Sequence[str] = (),
        file_size_bytes: Optional[int] = None,
        keyword_density: float = 0.0,
        word_count: Optional[int] = None,
    ) -> ATSCheck:
        """Score ATS parseability and list concrete issues.

        ``raw_text`` should be the *pre-cleaning* extraction so that layout
        artefacts (multi-column gaps, exotic characters) are still visible.
        """
        issues: List[ATSIssue] = []
        passed = 0
        total = 0
        earned_weight = 0.0
        total_weight = 0.0
        words = word_count if word_count is not None else len((raw_text or "").split())

        # Severity doubles as the check's weight: failing an "error" level check
        # costs more than failing an "info" level one.
        check_weights = {
            IssueSeverity.ERROR: 3.0,
            IssueSeverity.WARNING: 2.0,
            IssueSeverity.INFO: 1.0,
        }

        def check(name: str, ok: bool, severity: IssueSeverity, message: str,
                  fix: str = "", success_message: str = "") -> None:
            nonlocal passed, total, earned_weight, total_weight
            total += 1
            weight = check_weights.get(severity, 1.0)
            total_weight += weight
            if ok:
                passed += 1
                earned_weight += weight
                if success_message:
                    issues.append(
                        ATSIssue(type=IssueSeverity.SUCCESS, message=success_message,
                                 code=name, fix="")
                    )
                return
            issues.append(ATSIssue(type=severity, message=message, code=name, fix=fix))

        # 1. Text extractability ----------------------------------------- #
        text_based = extracted.extraction_method.value in {"pdfplumber", "plain_text", "docx"}
        check(
            "text_extractable",
            bool(text_based and len(raw_text.strip()) >= settings.min_extracted_chars),
            IssueSeverity.ERROR,
            "This document is image-based: ATS parsers cannot read it without OCR, and most "
            "discard such resumes outright.",
            "Export a text-based PDF (File > Export > PDF from Word/Docs/LaTeX) rather than "
            "printing to an image or scanning a paper copy.",
            success_message="File is a text-based document — machine readable (good).",
        )

        # 2. Contact information ------------------------------------------ #
        has_contact = bool(emails or phones)
        check(
            "contact_info",
            has_contact,
            IssueSeverity.WARNING,
            "No email address or phone number could be extracted from the document.",
            "Put your email and phone in the top third of page 1 as plain text (not in a header, "
            "footer, table or image).",
            success_message="Contact details are machine-readable.",
        )

        # 3. Standard section headers -------------------------------------- #
        detected = {s.lower() for s in sections}
        expected = {"experience", "education", "skills"}
        missing = sorted(expected - detected)
        check(
            "standard_headers",
            not missing,
            IssueSeverity.WARNING,
            f"Standard section header(s) not detected: {', '.join(missing)}.",
            "Use conventional headings ('Experience', 'Education', 'Skills'). ATS parsers map "
            "sections by heading text, so creative titles like 'My Journey' are missed.",
            success_message="Standard section headers detected.",
        )

        # 4. Tables -------------------------------------------------------- #
        check(
            "no_tables",
            extracted.tables_detected == 0,
            IssueSeverity.WARNING,
            f"Detected {extracted.tables_detected} table structure(s). Many ATS parsers flatten "
            "tables and lose the column association between skills, dates and roles.",
            "Replace tables with simple left-aligned text and bullet lists.",
            success_message="No table layouts detected.",
        )

        # 5. Images -------------------------------------------------------- #
        check(
            "few_images",
            extracted.images_detected <= 2,
            IssueSeverity.WARNING,
            f"{extracted.images_detected} embedded image(s) detected. Graphics, photo headshots "
            "and icon bullets are invisible to ATS parsers.",
            "Remove images and icon fonts; use plain text bullets.",
        )

        # 6. Multi-column layout ------------------------------------------- #
        column_lines = len(COLUMN_GAP_RE.findall(raw_text or ""))
        check(
            "single_column",
            column_lines < 4,
            IssueSeverity.WARNING,
            f"Possible multi-column layout detected ({column_lines} lines with wide internal gaps). "
            "Two-column resumes are frequently read out of order.",
            "Use a single-column layout so the reading order matches the visual order.",
            success_message="Single-column reading order detected.",
        )

        # 7. Page count ---------------------------------------------------- #
        pages = extracted.page_count or 1
        check(
            "page_count",
            1 <= pages <= 3,
            IssueSeverity.INFO,
            f"Document is {pages} pages long; 1-2 pages is the norm for most roles.",
            "Trim older or irrelevant experience to keep it to 1-2 pages.",
            success_message=f"{pages}-page document (within the recommended range).",
        )

        # 8. Length -------------------------------------------------------- #
        check(
            "word_count",
            250 <= words <= 1500,
            IssueSeverity.INFO,
            f"Document length is {words} words (recommended 350-1000 for most roles).",
            "Adjust detail level so each role has 3-6 achievement bullets.",
        )

        # 9. File size ----------------------------------------------------- #
        if file_size_bytes is not None:
            size_mb = file_size_bytes / (1024 * 1024)
            check(
                "file_size",
                size_mb <= 1.0,
                IssueSeverity.INFO,
                f"File size is {size_mb:.1f} MB; some ATS portals reject uploads above 1-2 MB.",
                "Reduce image resolution or re-export the PDF to shrink it.",
                success_message=f"File size {size_mb:.2f} MB (portal friendly).",
            )

        # 10. Exotic characters -------------------------------------------- #
        emoji = EMOJI_RE.findall(raw_text or "")
        non_ascii = NON_ASCII_RE.findall(raw_text or "")
        check(
            "clean_charset",
            not emoji and len(non_ascii) <= 12,
            IssueSeverity.WARNING if emoji else IssueSeverity.INFO,
            (
                f"Found {len(emoji)} emoji/symbol character(s) and {len(non_ascii)} non-ASCII "
                "character(s). Decorative glyphs often become '?' or break parsing."
            ),
            "Replace emoji bullets and special glyphs with plain hyphens or standard bullets.",
            success_message="Character set is ASCII-clean.",
        )

        # 11. Bullet usage ------------------------------------------------- #
        bullets = len(BULLET_RE.findall(raw_text or ""))
        check(
            "bullet_points",
            bullets >= 3,
            IssueSeverity.INFO,
            f"Only {bullets} bullet point(s) detected; dense paragraphs are hard for both ATS "
            "and recruiters to parse.",
            "Break achievements into bullet points, one result per bullet.",
            success_message=f"{bullets} bullet points detected.",
        )

        # 12. Dates -------------------------------------------------------- #
        dates_found = len(DATE_LINE_RE.findall(raw_text or ""))
        check(
            "parseable_dates",
            dates_found >= 1,
            IssueSeverity.WARNING,
            "No standard employment dates (e.g. 'Jan 2019 - Present') were detected.",
            "Add month/year ranges for every role so experience-length filters can score you.",
            success_message=f"{dates_found} parseable date range(s) detected.",
        )

        # 13. Keyword stuffing --------------------------------------------- #
        check(
            "keyword_density",
            keyword_density <= settings.keyword_density_target_high,
            IssueSeverity.WARNING,
            f"Keyword density is {keyword_density:.1%}, which can read as keyword stuffing.",
            "Keep each keyword to a few natural mentions.",
        )

        # 14. OCR quality -------------------------------------------------- #
        if extracted.ocr_attempted and extracted.is_scanned:
            issues.append(
                ATSIssue(
                    type=IssueSeverity.INFO,
                    message=(
                        "Text was recovered with OCR, which is lossy. Scores may under-report "
                        "content that the scanner mis-read."
                    ),
                    code="ocr_quality",
                    fix="Upload the original text-based export instead of a scan.",
                )
            )
        if extracted.warnings:
            for warning in extracted.warnings[:3]:
                issues.append(
                    ATSIssue(type=IssueSeverity.INFO, message=warning, code="extractor_warning")
                )

        score = round(clamp(100.0 * earned_weight / total_weight, 0.0, 100.0), 1) if total_weight else 0.0

        result = ATSCheck(
            score=score,
            issues=issues,
            checks_passed=passed,
            checks_total=total,
            is_text_based=text_based,
            standard_headers_used=not missing,
            contact_info_found=has_contact,
        )
        logger.info(
            "ats_check_generated",
            extra={
                "score": score,
                "passed": passed,
                "total": total,
                "errors": sum(1 for i in issues if i.type == IssueSeverity.ERROR),
                "warnings": sum(1 for i in issues if i.type == IssueSeverity.WARNING),
            },
        )
        return result


#: Shared generator instance.
report_generator = ReportGenerator()

__all__ = ["ReportGenerator", "report_generator"]
