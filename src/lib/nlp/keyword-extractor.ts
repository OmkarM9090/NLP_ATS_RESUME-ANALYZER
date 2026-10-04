import type { ProcessedDoc, Token } from "./tokenizer";
import { STOPWORDS } from "./data/stopwords";

/* ------------------------------------------------------------------
 * Keyword extraction: TF-IDF (sentences as documents, 1–3 grams)
 * combined with a RAKE-style co-occurrence phrase scorer.
 * ------------------------------------------------------------------ */

export interface KeywordScore {
  keyword: string;
  score: number; // tf-idf (unnormalized)
}

function isContentToken(t: Token): boolean {
  return (
    !t.isPunct &&
    t.isAlpha &&
    t.lower.length > 1 &&
    (!t.isStop || /^[A-Z]{2,}$/.test(t.text))
  );
}

/** Build n-gram term sequences from a sentence's filtered tokens.
 *  Phrases break at punctuation, numbers, and verbs; stopwords may
 *  bridge inside n-grams but never become standalone keywords. */
function sentenceTerms(tokens: Token[]): string[] {
  const lemmas = tokens
    .filter((t) => !t.isPunct && t.isAlpha && t.lower.length > 1)
    .map((t) => t.lemma);

  // contiguous runs, split on punct/NUM/VERB boundaries
  const runs: Token[][] = [];
  let run: Token[] = [];
  const flush = () => {
    if (run.length) runs.push(run);
    run = [];
  };
  for (const t of tokens) {
    if (isContentToken(t)) {
      if (t.pos === "VERB" && run.length > 0) flush();
      run.push(t);
    } else if (t.isPunct || t.pos === "NUM" || !t.isAlpha) {
      flush();
    } else {
      run.push(t); // stopword — allowed inside phrases
    }
  }
  flush();

  const terms: string[] = [];
  for (const r of runs) {
    for (const t of r) {
      if (!t.isStop) terms.push(t.lemma); // no stopword unigrams
    }
    for (const n of [2, 3]) {
      for (let i = 0; i + n <= r.length; i++) {
        const phrase = r.slice(i, i + n);
        if (phrase[0].pos === "VERB" && n >= 3) continue; // skip verb-led trigrams
        if (phrase[0].isStop || phrase[n - 1].isStop) continue; // trim stopword edges
        const kw = phrase.map((t) => t.lemma).join(" ");
        if (kw.split(" ").some((w) => w.length <= 1)) continue;
        terms.push(kw);
      }
    }
  }

  if (terms.length === 0) return lemmas;

  // Dedupe identical terms within the same sentence
  return Array.from(new Set(terms));
}

export function extractTfIdfKeywords(
  doc: ProcessedDoc,
  topN = 40,
): KeywordScore[] {
  const sentences = doc.sentences;
  const N = Math.max(sentences.length, 2);

  const sentenceTermLists = sentences.map((s) => sentenceTerms(s));
  const df = new Map<string, number>();
  for (const terms of sentenceTermLists) {
    for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const scores = new Map<string, number>();
  for (const terms of sentenceTermLists) {
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, f] of tf) {
      const idf = Math.log(1 + N / (df.get(t) ?? 1));
      const lengthBoost = t.includes(" ") ? 1.4 : 1; // favor phrases
      scores.set(t, (scores.get(t) ?? 0) + f * idf * lengthBoost);
    }
  }

  // Demote over-common single unigrams that appear in nearly every sentence
  for (const [t, s] of scores) {
    const d = df.get(t) ?? 0;
    if (!t.includes(" ") && d > 0.85 * N && N >= 8) {
      scores.set(t, s * 0.35);
    }
    // Trigrams must repeat at least once to outrank — kills one-off layout junk
    if (t.split(" ").length === 3 && d < 2) {
      scores.set(t, s * 0.25);
    }
  }

  return Array.from(scores.entries())
    .map(([keyword, score]) => ({ keyword, score: Math.round(score * 1000) / 1000 }))
    .filter((k) => k.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/** RAKE: split candidate phrases by stopwords, score by word degree/frequency. */
export function extractRakeKeywords(doc: ProcessedDoc, topN = 25): KeywordScore[] {
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();
  const phraseFreq = new Map<string, number>();

  for (const sent of doc.sentences) {
    let candidate: string[] = [];
    const flush = () => {
      if (candidate.length > 0 && candidate.length <= 4) {
        const phrase = candidate.join(" ");
        phraseFreq.set(phrase, (phraseFreq.get(phrase) ?? 0) + 1);
        const deg = candidate.length - 1;
        for (const w of candidate) {
          freq.set(w, (freq.get(w) ?? 0) + 1);
          degree.set(w, (degree.get(w) ?? 0) + deg);
        }
      }
      candidate = [];
    };
    for (const t of sent) {
      if (
        t.isPunct ||
        t.isStop ||
        !t.isAlpha ||
        t.lower.length < 2 ||
        t.pos === "NUM"
      ) {
        flush();
      } else {
        candidate.push(t.lemma);
      }
    }
    flush();
  }

  const wordScore = new Map<string, number>();
  for (const [w, f] of freq) {
    wordScore.set(w, ((degree.get(w) ?? 0) + f) / f);
  }

  const scored = new Map<string, number>();
  for (const [phrase, count] of phraseFreq) {
    if (count < 1) continue;
    let s = 0;
    for (const w of phrase.split(" ")) s += wordScore.get(w) ?? 0;
    scored.set(phrase, s * Math.min(count, 3));
  }

  return Array.from(scored.entries())
    .map(([keyword, score]) => ({ keyword, score: Math.round(score * 100) / 100 }))
    .filter((k) => k.score > 0 && !STOPWORDS.has(k.keyword))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/** Merge TF-IDF + RAKE rankings via reciprocal-rank fusion. */
export function extractCombinedKeywords(
  doc: ProcessedDoc,
  topN = 30,
): KeywordScore[] {
  const tfidf = extractTfIdfKeywords(doc, topN * 2);
  const rake = extractRakeKeywords(doc, topN * 2);

  const rrf = new Map<string, number>();
  const K = 12;
  tfidf.forEach((k, i) => {
    rrf.set(k.keyword, (rrf.get(k.keyword) ?? 0) + 1 / (K + i + 1));
  });
  rake.forEach((k, i) => {
    rrf.set(k.keyword, (rrf.get(k.keyword) ?? 0) + 0.8 / (K + i + 1));
  });

  const tfidfScoreByKeyword = new Map(tfidf.map((k) => [k.keyword, k.score]));
  const maxTf = Math.max(...tfidf.map((k) => k.score), 1);

  return Array.from(rrf.entries())
    .map(([keyword, rrfScore]) => ({
      keyword,
      // expose a tf-idf-like normalized score for UI weighting
      score: Math.round(((tfidfScoreByKeyword.get(keyword) ?? rrfScore * maxTf * 0.4) ) * 1000) / 1000,
      _rrf: rrfScore,
    }))
    .sort((a, b) => b._rrf - a._rrf)
    .slice(0, topN)
    .map(({ keyword, score }) => ({ keyword, score }));
}

/** Count literal occurrences of a keyword/phrase in document text. */
export function countOccurrences(keyword: string, doc: ProcessedDoc): number {
  const lower = doc.cleaned.text.toLowerCase();
  const k = keyword.toLowerCase();
  if (!k.includes(" ")) {
    let n = 0;
    for (const t of doc.filteredTokens) if (t.lemma === k || t.lower === k) n++;
    return n;
  }
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(k, idx)) !== -1) {
    count++;
    idx += k.length;
  }
  return count;
}

/** Does this JD keyword appear anywhere in the resume? */
export function keywordPresentInDoc(keyword: string, doc: ProcessedDoc): boolean {
  const k = keyword.toLowerCase();
  if (!k.includes(" ")) {
    return doc.lemmaSet.has(k);
  }
  // phrase: substring on cleaned text, or every constituent lemma present
  const lower = doc.cleaned.text.toLowerCase();
  if (lower.includes(k)) return true;
  const parts = k.split(" ").filter((p) => !STOPWORDS.has(p));
  return parts.length > 0 && parts.every((p) => doc.lemmaSet.has(p));
}
