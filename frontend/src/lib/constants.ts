import type { Grade, PipelineStage, ScoreDimension } from "@/types";

/* -------------------------------------------------------------------------- */
/* Upload rules (mirrored from backend/config.py)                              */
/* -------------------------------------------------------------------------- */

export const MAX_FILE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? 10);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_EXTENSIONS = (
  process.env.NEXT_PUBLIC_ALLOWED_EXTENSIONS ?? ".pdf,.txt,.docx"
)
  .split(",")
  .map((ext) => ext.trim().toLowerCase())
  .filter(Boolean);

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(",");

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "ATS Resume Matcher";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

/* -------------------------------------------------------------------------- */
/* Pipeline — the step-by-step loader on /analyze                              */
/* -------------------------------------------------------------------------- */

/**
 * Backend stage names in execution order, with human copy. The percentages are
 * the values `run_full_analysis` reports through its progress callback, so the
 * loader can animate even before the first event arrives.
 */
export const PIPELINE_STAGES: PipelineStage[] = [
  {
    key: "extracting_text",
    label: "Extracting text",
    description: "Reading the PDF layer, with OCR fallback for scans.",
    progress: 5,
  },
  {
    key: "cleaning_text",
    label: "Cleaning & normalising",
    description: "Stripping headers, ligatures and control characters.",
    progress: 10,
  },
  {
    key: "tokenizing",
    label: "Tokenizing",
    description: "Splitting into tokens while protecting C++, CI/CD, .NET.",
    progress: 14,
  },
  {
    key: "pos_tagging",
    label: "POS tagging",
    description: "Labelling nouns, verbs and adjectives.",
    progress: 17,
  },
  {
    key: "removing_stop_words",
    label: "Removing stop words",
    description: "Dropping filler words, keeping R, AI, ML and Go.",
    progress: 20,
  },
  {
    key: "lemmatizing",
    label: "Lemmatizing",
    description: "Reducing inflections to their dictionary form.",
    progress: 23,
  },
  {
    key: "entity_recognition",
    label: "Named entities",
    description: "Finding skills, degrees, companies and locations.",
    progress: 26,
  },
  {
    key: "parsing_sections",
    label: "Parsing sections",
    description: "Mapping Experience, Education, Skills and more.",
    progress: 30,
  },
  {
    key: "extracting_entities",
    label: "Structuring entities",
    description: "Building the resume and job-description profiles.",
    progress: 38,
  },
  {
    key: "extracting_keywords",
    label: "Extracting keywords",
    description: "TF-IDF, RAKE and TextRank, weighted and merged.",
    progress: 50,
  },
  {
    key: "matching_skills",
    label: "Matching skills",
    description: "Canonical aliases, fuzzy and semantic matching.",
    progress: 60,
  },
  {
    key: "vectorizing",
    label: "Vectorizing",
    description: "Embedding both documents for comparison.",
    progress: 66,
  },
  {
    key: "computing_semantic_similarity",
    label: "Semantic similarity",
    description: "Cosine similarity between the two embeddings.",
    progress: 72,
  },
  {
    key: "computing_scores",
    label: "Computing scores",
    description: "Five weighted dimensions and the overall match.",
    progress: 85,
  },
  {
    key: "analyzing_gaps",
    label: "Analyzing gaps",
    description: "Missing skills, keywords and weak sections.",
    progress: 92,
  },
  {
    key: "generating_report",
    label: "Generating report",
    description: "ATS formatting checks and recommendations.",
    progress: 96,
  },
  {
    key: "complete",
    label: "Complete",
    description: "Analysis ready.",
    progress: 100,
  },
];

export const STAGE_KEYS = PIPELINE_STAGES.map((stage) => stage.key);

/* -------------------------------------------------------------------------- */
/* Scoring vocabulary                                                          */
/* -------------------------------------------------------------------------- */

export const SCORE_DIMENSIONS: Array<{
  key: ScoreDimension;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    key: "keyword_match",
    label: "Keyword match",
    shortLabel: "Keywords",
    description: "TF-IDF overlap plus coverage of the posting's top terms.",
  },
  {
    key: "semantic_similarity",
    label: "Semantic similarity",
    shortLabel: "Semantic",
    description: "Meaning-level similarity between the two documents.",
  },
  {
    key: "skill_match",
    label: "Skill match",
    shortLabel: "Skills",
    description: "Taxonomy-aware comparison of required versus listed skills.",
  },
  {
    key: "experience_relevance",
    label: "Experience relevance",
    shortLabel: "Experience",
    description: "Years, seniority and role alignment with the posting.",
  },
  {
    key: "education_match",
    label: "Education match",
    shortLabel: "Education",
    description: "Degree level and field of study against the requirement.",
  },
];

export const GRADE_LABELS: Record<Grade, string> = {
  A: "Excellent",
  B: "Strong",
  C: "Moderate",
  D: "Weak",
  F: "Poor",
};

/** Tailwind text/border/background classes per grade. */
export const GRADE_TOKENS: Record<
  Grade,
  { text: string; bg: string; border: string; ring: string; hex: string }
> = {
  A: {
    text: "text-success",
    bg: "bg-success/12",
    border: "border-success/40",
    ring: "ring-success/30",
    hex: "#10B981",
  },
  B: {
    text: "text-secondary-300",
    bg: "bg-secondary/12",
    border: "border-secondary/40",
    ring: "ring-secondary/30",
    hex: "#22D3EE",
  },
  C: {
    text: "text-warning",
    bg: "bg-warning/12",
    border: "border-warning/40",
    ring: "ring-warning/30",
    hex: "#F59E0B",
  },
  D: {
    text: "text-orange-400",
    bg: "bg-orange-500/12",
    border: "border-orange-500/40",
    ring: "ring-orange-500/30",
    hex: "#FB923C",
  },
  F: {
    text: "text-danger",
    bg: "bg-danger/12",
    border: "border-danger/40",
    ring: "ring-danger/30",
    hex: "#EF4444",
  },
};

export const PRIORITY_TOKENS: Record<string, { text: string; bg: string; border: string; label: string }> = {
  high: { text: "text-danger", bg: "bg-danger/12", border: "border-danger/35", label: "High priority" },
  medium: { text: "text-warning", bg: "bg-warning/12", border: "border-warning/35", label: "Medium priority" },
  low: { text: "text-secondary-300", bg: "bg-secondary/12", border: "border-secondary/35", label: "Low priority" },
};

const PRIORITY_FALLBACK = {
  text: "text-ink-muted",
  bg: "bg-surface-raised",
  border: "border-line",
  label: "Low priority",
};

/** Priority tokens with a safe fallback (indexes on a Record can be undefined). */
export function priorityTokens(priority: string) {
  return PRIORITY_TOKENS[priority] ?? PRIORITY_FALLBACK;
}

export const SECTION_LABELS: Record<string, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  languages: "Languages",
  volunteering: "Volunteering",
  references: "References",
  unstructured: "Unstructured content",
};

export const DENSITY_LABELS: Record<string, string> = {
  under_optimized: "Under-optimised",
  optimal: "Optimal",
  over_optimized: "Over-optimised",
};

/* -------------------------------------------------------------------------- */
/* Marketing copy (landing page)                                               */
/* -------------------------------------------------------------------------- */

export const STATS = [
  { value: 12, suffix: "", label: "NLP pipeline stages", sublabel: "Extraction to recommendation" },
  { value: 99, suffix: "%", label: "ATS parse accuracy", sublabel: "On text-based resumes" },
  { value: 5, suffix: "", label: "Weighted dimensions", sublabel: "Keywords, semantics, skills…" },
  { value: 157, suffix: "+", label: "Canonical skills", sublabel: "774 aliases resolved" },
] as const;

export const MARQUEE_TERMS = [
  "TF-IDF", "RAKE", "TextRank", "spaCy NER", "Sentence-BERT", "LSA fallback",
  "Cosine similarity", "Skill taxonomy", "Fuzzy matching", "Section parsing",
  "Lemmatization", "POS tagging", "OCR fallback", "Gap analysis",
] as const;

export const FEATURES = [
  {
    title: "Twelve-stage NLP pipeline",
    body: "Every upload is extracted, cleaned, tokenized, lemmatized, POS-tagged, entity-parsed, keyword-scored, sectioned, vectorised, compared, scored and reported — no shortcuts.",
    icon: "pipeline",
    points: ["pdfplumber + OCR fallback", "TF-IDF, RAKE and TextRank", "spaCy NER with a skill taxonomy"],
  },
  {
    title: "Semantic understanding, not string matching",
    body: "Sentence-transformers embeddings capture meaning, so “managed K8s workloads” matches “Kubernetes orchestration” even with no shared keywords.",
    icon: "semantic",
    points: ["all-MiniLM-L6-v2 embeddings", "TF-IDF/LSA fallback offline", "Per-section similarity"],
  },
  {
    title: "Five weighted scores",
    body: "Keywords 25%, semantics 30%, skills 25%, experience 10%, education 10% — calibrated so a 70 means “strong”, not “lucky”.",
    icon: "scores",
    points: ["Transparent detail strings", "Custom weight overrides", "A–F grading"],
  },
  {
    title: "ATS formatting audit",
    body: "Thirteen parser-hostile patterns are checked: tables, columns, images, glyph bullets, missing contact data, unparseable dates and more.",
    icon: "shield",
    points: ["Weighted 0–100 score", "Concrete fixes per issue", "Severity-aware"],
  },
  {
    title: "Gap analysis that ranks",
    body: "Missing skills are separated into required and nice-to-have, keywords carry importance, and weak sections get a rewrite suggestion.",
    icon: "gap",
    points: ["Required vs preferred", "Severity from JD emphasis", "Section-level advice"],
  },
  {
    title: "Honest about degradation",
    body: "If model weights cannot load, the API says so in nlp_metadata, /api/health and /api/models — scores stay comparable, never silently wrong.",
    icon: "trust",
    points: ["degraded_mode flag", "Per-model error strings", "Deterministic fallbacks"],
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Upload both documents",
    body: "Drop a resume and a job description — PDF, TXT or DOCX, up to 10 MB each. Scanned PDFs fall back to OCR when tesseract is available.",
    detail: "POST /api/analyze (multipart)",
  },
  {
    step: "02",
    title: "Watch the pipeline run",
    body: "Seventeen progress events stream from extraction to report generation, each with a percentage so the loader is real, not decorative.",
    detail: "12 NLP stages · ~1s typical",
  },
  {
    step: "03",
    title: "Read the scored breakdown",
    body: "An overall score, five weighted dimensions with plain-English detail strings, matched and missing skills, keyword coverage and density.",
    detail: "overall_score · score_breakdown",
  },
  {
    step: "04",
    title: "Fix what matters first",
    body: "Prioritised recommendations, an ATS formatting audit with concrete fixes, per-section scores and a full NLP metadata panel.",
    detail: "recommendations · ats_formatting",
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "I rewrote three bullet points using the missing-keyword list and went from silence to two interviews in a week. The ATS audit caught a two-column layout I had no idea was breaking parsers.",
    name: "Priya Nair",
    role: "Senior Data Engineer",
    metric: "62 → 88 overall score",
  },
  {
    quote:
      "As a recruiter I run every shortlist through it. The skill precision and recall numbers tell me instantly whether a resume genuinely matches or just keyword-stuffs.",
    name: "Daniel Okafor",
    role: "Technical Recruiter",
    metric: "Screens 40 resumes/week",
  },
  {
    quote:
      "The gap analysis separates required from nice-to-have, which is exactly what a career switcher needs. I stopped wasting effort on preferred skills I would never use.",
    name: "Marta Kowalski",
    role: "ML Engineer, ex-academia",
    metric: "Career switch to ML",
  },
  {
    quote:
      "What sold me is the honesty: when the transformer weights were unavailable the API told us it was running the LSA fallback instead of pretending nothing changed.",
    name: "Rahul Verma",
    role: "Platform Engineering Lead",
    metric: "Self-hosted deployment",
  },
] as const;

export const PRICING_TIERS = [
  {
    name: "Self-hosted",
    price: "Free",
    period: "forever",
    tagline: "The entire stack, on your machine.",
    features: [
      "Full 12-stage NLP pipeline",
      "Unlimited analyses",
      "Docker Compose deploy",
      "SQLite history storage",
      "MIT-licensed source",
    ],
    cta: "Read the docs",
    href: "https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER",
    highlighted: false,
  },
  {
    name: "Job Seeker",
    price: "$0",
    period: "per analysis",
    tagline: "Every feature, no account required.",
    features: [
      "Resume ↔ JD match scoring",
      "Skill gap & keyword analysis",
      "ATS formatting audit",
      "Prioritised recommendations",
      "Export results as JSON",
      "Analysis history on device",
    ],
    cta: "Analyse a resume",
    href: "/analyze",
    highlighted: true,
  },
  {
    name: "Team",
    price: "Custom",
    period: "per seat",
    tagline: "For recruiting teams and career services.",
    features: [
      "Everything in Job Seeker",
      "Bulk screening API access",
      "Custom skill taxonomies",
      "Private model weights",
      "SSO & audit logs",
      "Priority support",
    ],
    cta: "Talk to us",
    href: "mailto:hello@example.com",
    highlighted: false,
  },
] as const;

export const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Analyse a resume", href: "/analyze" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Pipeline",
    links: [
      { label: "Text extraction + OCR", href: "/#how-it-works" },
      { label: "Keyword extraction", href: "/#features" },
      { label: "Semantic similarity", href: "/#features" },
      { label: "Scoring model", href: "/#features" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API docs", href: "/docs" },
      { label: "Health endpoint", href: "/api/health" },
      { label: "GitHub", href: "https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER" },
      { label: "Docker Compose", href: "https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER#running-with-docker" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "ATS formatting guide", href: "/#features" },
      { label: "Skill taxonomy", href: "/#features" },
      { label: "Scoring weights", href: "/#features" },
      { label: "Privacy", href: "/#faq" },
    ],
  },
] as const;

export const FAQS = [
  {
    q: "Is my resume stored anywhere?",
    a: "Analyses are saved to a local SQLite database so you can revisit them from the history list. Nothing is sent to a third party, and DELETE /api/history removes everything.",
  },
  {
    q: "Which models does the scoring use?",
    a: "spaCy en_core_web_lg for linguistic analysis and all-MiniLM-L6-v2 for sentence embeddings. If either cannot load, the API falls back to an offline heuristic pipeline and a TF-IDF/LSA encoder, and reports that in nlp_metadata.degraded_mode.",
  },
  {
    q: "Why does my score change between runs?",
    a: "It should not. With the same inputs and the same weights the pipeline is deterministic — the test suite asserts repeated runs produce the same score, grade and matched skills.",
  },
  {
    q: "Can scanned PDFs be analysed?",
    a: "Yes, when tesseract and poppler are installed (the Docker image includes both). Without OCR the API returns a 422 explaining that the document is image-only.",
  },
] as const;
