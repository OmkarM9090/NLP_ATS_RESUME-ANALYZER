import type { ProcessedDoc, Token } from "./tokenizer";
import { clamp01 } from "@/lib/utils";

/* ------------------------------------------------------------------
 * Semantic analyzer — embedding-free semantic similarity:
 *   1. document-level TF-IDF cosine over shared vocabulary
 *   2. sentence-embedding-style coverage: for every JD sentence, the
 *      best cosine match over resume sentences (mirrors how
 *      sentence-transformer retrieval behaves), averaged
 * ------------------------------------------------------------------ */

type SparseVec = Map<string, number>;

export function buildIdf(corpus: Token[][][]): Map<string, number> {
  // corpus = list of documents; each doc = list of sentences (tokens)
  const df = new Map<string, number>();
  let docCount = 0;
  for (const doc of corpus) {
    for (const sent of doc) {
      docCount++;
      const terms = new Set(
        sent.filter((t) => !t.isPunct && t.isAlpha && !t.isStop && t.lower.length > 1).map((t) => t.lemma),
      );
      for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + docCount / d));
  return idf;
}

function tfVec(tokens: Token[], idf: Map<string, number>): SparseVec {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    if (t.isPunct || !t.isAlpha || t.isStop || t.lower.length <= 1) continue;
    tf.set(t.lemma, (tf.get(t.lemma) ?? 0) + 1);
  }
  const vec: SparseVec = new Map();
  for (const [term, f] of tf) {
    vec.set(term, (1 + Math.log(f)) * (idf.get(term) ?? 1));
  }
  return vec;
}

export function cosine(a: SparseVec, b: SparseVec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, va] of a) {
    na += va * va;
    const vb = b.get(k);
    if (vb) dot += va * vb;
  }
  for (const vb of b.values()) nb += vb * vb;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface SemanticResult {
  score01: number; // calibrated 0..1 semantic similarity
  cosineSimilarity: number;
  sentenceCoverage: number;
}

export function computeSemanticSimilarity(
  resumeDoc: ProcessedDoc,
  jdDoc: ProcessedDoc,
): SemanticResult {
  const idf = buildIdf([resumeDoc.sentences, jdDoc.sentences]);

  // document-level cosine
  const resumeVec = tfVec(resumeDoc.tokens, idf);
  const jdVec = tfVec(jdDoc.tokens, idf);
  const cosineSim = cosine(resumeVec, jdVec);

  // sentence-coverage (like SBERT bi-encoder retrieval)
  const resumeSentVecs = resumeDoc.sentences
    .filter((s) => s.filter((t) => !t.isPunct && t.isAlpha && !t.isStop).length >= 3)
    .map((s) => tfVec(s, idf));
  const jdSentVecs = jdDoc.sentences
    .filter((s) => s.filter((t) => !t.isPunct && t.isAlpha && !t.isStop).length >= 3)
    .map((s) => tfVec(s, idf));

  let coverage = 0;
  if (jdSentVecs.length > 0 && resumeSentVecs.length > 0) {
    const bests: number[] = [];
    for (const jv of jdSentVecs) {
      let best = 0;
      for (const rv of resumeSentVecs) {
        const sim = cosine(jv, rv);
        if (sim > best) best = sim;
      }
      bests.push(best);
    }
    bests.sort((a, b) => b - a);
    const topHalf = bests.slice(0, Math.max(1, Math.ceil(bests.length * 0.6)));
    coverage = topHalf.reduce((a, b) => a + b, 0) / topHalf.length;
  }

  const raw = 0.6 * coverage + 0.4 * cosineSim;
  const score01 = clamp01(raw * 2.15 + (raw > 0.05 ? 0.04 : 0));

  return {
    score01,
    cosineSimilarity: Math.round(cosineSim * 1000) / 1000,
    sentenceCoverage: Math.round(coverage * 1000) / 1000,
  };
}

/** Similarity of one text block (e.g., a resume section) against a doc. */
export function blockSimilarityToDoc(
  blockTokens: Token[],
  doc: ProcessedDoc,
): number {
  const idf = buildIdf([doc.sentences, [blockTokens]]);
  const a = tfVec(blockTokens, idf);
  const b = tfVec(doc.tokens, idf);
  return cosine(a, b);
}
