import { randomUUID } from "crypto";
import type {
  AnalysisResponse,
  KeywordAnalysis,
  NLPMetadata,
  SectionScores,
} from "@/types/analysis";
import { processDocument } from "./tokenizer";
import { parseSections } from "./section-parser";
import {
  extractJDEntities,
  extractResumeEntities,
} from "./entity-extractor";
import { matchSkills } from "./skill-matcher";
import { computeSemanticSimilarity, blockSimilarityToDoc } from "./semantic-analyzer";
import { computeScores } from "./similarity-engine";
import { analyzeGaps } from "./gap-analyzer";
import {
  generateRecommendations,
  runATSCheck,
} from "./report-generator";
import {
  extractPdf,
  validatePdfBytes,
  NLPProcessingError,
  AnalysisError,
  type ExtractedPDF,
} from "./pdf-extractor";
import { SAMPLE_JD_TEXT, SAMPLE_RESUME_TEXT } from "./sample-data";
import { clamp01, round1 } from "@/lib/utils";

/* ------------------------------------------------------------------
 * Analysis service — orchestrates the complete pipeline:
 *   extract → clean → tokenize/lemmatize/POS → NER → sections →
 *   keywords → skills → semantic → multi-score → gaps → report
 * ------------------------------------------------------------------ */

export interface FileInput {
  bytes: Buffer;
  filename: string;
}

const MODELS_USED = [
  "rule-tokenizer+lemmatizer",
  "heuristic-pos",
  "tf-idf(ngram=1..3)",
  "rake",
  "semantic-sentence-coverage",
  "skill-taxonomy-v1",
  "gazetteer-ner",
];

function sectionFeedback(name: string, score: number): string {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  if (score >= 75)
    return `${label} aligns closely with the JD's language and priorities. Strong signal for both ATS and recruiters.`;
  if (score >= 55)
    return `${label} has decent overlap with the JD, but mirroring more of the posting's exact terminology would lift it.`;
  if (score >= 38)
    return `${label} partially matches this role. Rework it around the JD's core requirements and measurable outcomes.`;
  return `${label} overlaps weakly with this JD. This is a priority area to rewrite for the role.`;
}

function buildSectionScores(
  resSections: Record<string, string>,
  jdDoc: ReturnType<typeof processDocument>,
  dimensionFloors?: { skills?: number; education?: number },
  hasCertifications?: boolean,
): SectionScores {
  const out: SectionScores = {};
  for (const [name, text] of Object.entries(resSections)) {
    const blockDoc = processDocument(text);
    const sim = blockSimilarityToDoc(blockDoc.tokens, jdDoc);
    let score = Math.round(clamp01(sim * 2.35 + 0.02) * 100);
    let feedback: string | null = null;
    // Dedicated dimensions dominate terse sections (a 1-line degree is
    // best judged by the education matcher, not semantic overlap).
    if (name === "skills" && dimensionFloors?.skills != null) {
      score = Math.max(score, Math.round(dimensionFloors.skills));
    }
    if (name === "education" && dimensionFloors?.education != null) {
      score = Math.max(score, Math.round(dimensionFloors.education));
    }
    if (name === "certifications") {
      if (hasCertifications) {
        score = Math.max(score, 68);
        feedback =
          "Certifications detected and parseable. This JD doesn't explicitly require them, so impact is neutral-to-positive — keep them concise and relevant.";
      } else {
        feedback =
          "This section exists but no recognized certifications were detected. List certs with issuing body and year (e.g. “AWS Certified Developer – Associate, 2024”).";
      }
    }
    out[name] = {
      score: Math.min(100, score),
      similarity: round1(sim * 100) / 100,
      feedback: feedback ?? sectionFeedback(name, Math.min(100, score)),
    };
  }
  return out;
}

interface ExtractionInfo {
  resume: ExtractedPDF;
  jd: ExtractedPDF;
}

function coreAnalyze(
  resumeText: string,
  jdText: string,
  filenames: { resume: string; job_description: string },
  extraction: ExtractionInfo,
  t0: number,
): AnalysisResponse {
  try {
    // Stages 2–7: clean, tokenize, lemmatize, POS, NER-ready docs
    const resumeDoc = processDocument(resumeText);
    const jdDoc = processDocument(jdText);

    // Stage 8: section parsing (resume)
    const resSections = parseSections(resumeDoc.cleaned.text);

    // Entity extraction (NER layer)
    const resumeEntities = extractResumeEntities(resumeDoc);
    const jdEntities = extractJDEntities(jdDoc);

    // Skill taxonomy matching
    const jdSkillAll = Array.from(
      new Set([
        ...jdEntities.required_skills,
        ...jdEntities.preferred_skills,
      ]),
    );
    const skills = matchSkills(resumeEntities.skills, jdSkillAll);

    // Semantic similarity
    const semantic = computeSemanticSimilarity(resumeDoc, jdDoc);

    // Multi-dimensional scoring
    const scoring = computeScores({
      resume: resumeDoc,
      jd: jdDoc,
      skills,
      resumeEntities,
      jdEntities,
      semantic,
    });

    // Section-level scores
    const sectionScores = buildSectionScores(
      resSections.sections,
      jdDoc,
      {
        skills: scoring.breakdown.skill_match.score,
        education: scoring.breakdown.education_match.score,
      },
      resumeEntities.certifications.length > 0,
    );

    // Gap analysis
    const gaps = analyzeGaps({
      resume: resumeDoc,
      jd: jdDoc,
      skills,
      resumeEntities,
      jdEntities,
      scoring,
      sectionScores,
    });

    const keywordAnalysis: KeywordAnalysis = {
      top_jd_keywords: scoring.jdKeywords.slice(0, 18),
      keyword_density: {
        resume:
          Math.round((resumeDoc.filteredTokens.length / Math.max(resumeDoc.wordCount, 1)) * 1000) / 1000,
        jd: Math.round((jdDoc.filteredTokens.length / Math.max(jdDoc.wordCount, 1)) * 1000) / 1000,
      },
    };

    const recommendations = generateRecommendations({
      gaps,
      skills,
      keywords: keywordAnalysis,
      sectionScores,
      overall: scoring.overall,
    });

    const ats = runATSCheck({
      rawText: resumeText,
      extractionMethod: extraction.resume.method,
      pages: extraction.resume.pages,
      sections: resSections,
      contacts: resumeEntities.contacts,
      wordCount: resumeDoc.wordCount,
    });

    const metadata: NLPMetadata = {
      resume_word_count: resumeDoc.wordCount,
      jd_word_count: jdDoc.wordCount,
      resume_unique_tokens: resumeDoc.uniqueTokenCount,
      jd_unique_tokens: jdDoc.uniqueTokenCount,
      resume_pages: extraction.resume.pages,
      jd_pages: extraction.jd.pages,
      extraction: {
        resume: extraction.resume.method,
        jd: extraction.jd.method,
        scanned: extraction.resume.isScanned || extraction.jd.isScanned,
      },
      processing_time_ms: Date.now() - t0,
      models_used: MODELS_USED,
    };

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      filenames,
      overall_score: scoring.overall,
      score_breakdown: scoring.breakdown,
      skills_analysis: skills,
      keyword_analysis: keywordAnalysis,
      entity_extraction: {
        resume: resumeEntities,
        job_description: jdEntities,
      },
      section_scores: sectionScores,
      gap_analysis: gaps,
      ats_formatting: ats,
      recommendations,
      nlp_metadata: metadata,
    };
  } catch (err) {
    if (err instanceof AnalysisError) throw err;
    console.error("[nlp] processing failure:", err);
    throw new NLPProcessingError(
      "Something went wrong while analyzing the documents. Please try different files.",
    );
  }
}

/** Full PDF → analysis pipeline with validation + extraction. */
export async function runFullAnalysis(
  resumeFile: FileInput,
  jdFile: FileInput,
): Promise<AnalysisResponse> {
  const t0 = Date.now();

  validatePdfBytes(resumeFile.bytes, resumeFile.filename);
  validatePdfBytes(jdFile.bytes, jdFile.filename);

  const [resumePdf, jdPdf] = await Promise.all([
    extractPdf(resumeFile.bytes),
    extractPdf(jdFile.bytes),
  ]);

  return coreAnalyze(
    resumePdf.text,
    jdPdf.text,
    { resume: resumeFile.filename, job_description: jdFile.filename },
    { resume: resumePdf, jd: jdPdf },
    t0,
  );
}

/** Sample analysis through the same pipeline (bypasses PDF extraction). */
export function runSampleAnalysis(): AnalysisResponse {
  const t0 = Date.now();
  const estPages = (text: string) =>
    Math.max(1, Math.ceil(text.split(/\s+/).length / 450));
  const sample = (text: string): ExtractedPDF => ({
    text,
    pages: estPages(text),
    method: "sample-text",
    isScanned: false,
  });

  return coreAnalyze(
    SAMPLE_RESUME_TEXT,
    SAMPLE_JD_TEXT,
    {
      resume: "jordan-hayes-resume.pdf",
      job_description: "senior-fullstack-engineer-jd.pdf",
    },
    { resume: sample(SAMPLE_RESUME_TEXT), jd: sample(SAMPLE_JD_TEXT) },
    t0,
  );
}
