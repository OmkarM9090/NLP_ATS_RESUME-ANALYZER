import { STOPWORDS } from "./data/stopwords";
import { cleanText, type CleanedText } from "./text-cleaner";

/* ------------------------------------------------------------------
 * Tokenizer + rule-based lemmatizer + heuristic POS tagger.
 * Produces a spaCy-style processed document structure.
 * ------------------------------------------------------------------ */

export type PosTag = "NOUN" | "PROPN" | "VERB" | "ADJ" | "ADV" | "NUM" | "X";

export interface Token {
  text: string;
  lower: string;
  lemma: string;
  pos: PosTag;
  isStop: boolean;
  isPunct: boolean;
  isAlpha: boolean;
  isLineStart: boolean;
}

export interface ProcessedDoc {
  raw: string;
  cleaned: CleanedText;
  sentences: Token[][];
  tokens: Token[];
  filteredTokens: Token[];
  lemmas: string[];
  lemmaSet: Set<string>;
  nounPhrases: string[];
  wordCount: number;
  uniqueTokenCount: number;
  posDistribution: Record<string, number>;
}

const IRREGULAR_LEMMAS: Record<string, string> = {
  ran: "run",
  built: "build",
  led: "lead",
  wrote: "write",
  written: "write",
  went: "go",
  made: "make",
  took: "take",
  grew: "grow",
  drove: "drive",
  spoke: "speak",
  managed: "manage",
  data: "datum",
  people: "person",
  children: "child",
};

/* Words whose trailing "s" is not a plural marker */
const S_TERMINAL_EXCEPTIONS = new Set([
  "kubernetes", "jenkins", "salesforce", "vercel", "datadog",
  "ws", "tls", "ssl", "dns", "aws", "gcp", "ios", "js", "ts", "sdk", "api",
]);

const COMMON_VERBS = new Set([
  "lead","manage","develop","build","design","implement","create","launch",
  "drive","improve","optimize","deliver","architect","mentor","own","ship",
  "collaborate","scale","maintain","deploy","automate","reduce","increase",
  "analyze","analyse","write","test","debug","review","plan","execute",
  "migrate","integrate","refactor","spearhead","establish","coordinate",
]);

/** Rule-based lemmatization (conservative, tech-aware). */
export function lemmatize(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 2) return w;
  if (S_TERMINAL_EXCEPTIONS.has(w)) return w;
  if (IRREGULAR_LEMMAS[w]) return IRREGULAR_LEMMAS[w];

  // possessive
  if (w.endsWith("'s")) w = w.slice(0, -2);

  if (/[^a-z]/.test(w)) return w; // keep tech tokens ("c++", "node.js") intact

  if (w.length > 5 && w.endsWith("ies") && !/(a|e|i)ies$/.test(w)) {
    return w.slice(0, -3) + "y";
  }
  if (w.length > 4 && /(sses|shes|ches|xes|zes)$/.test(w)) {
    return w.replace(/(ss)es$/, "ss").replace(/(sh|ch|x|z)es$/, "$1");
  }
  if (w.length > 5 && w.endsWith("ing") && /[aeiou][^aeiouwxy]ing$/.test(w)) {
    let stem = w.slice(0, -3);
    // running → run, shipping → ship (double consonant)
    if (stem.length > 2 && stem.endsWith(stem[stem.length - 1].repeat(2)) && /[^aeiou]{2}$/.test(stem)) {
      stem = stem.slice(0, -1);
    }
    if (/[aeiou]/.test(stem)) return stem;
    return w;
  }
  if (w.length > 4 && w.endsWith("ied")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed") && /[^aeiou][aeiou][^aeiouwxy]ed$/.test(w)) {
    return w.slice(0, -2);
  }
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) {
    return w.slice(0, -1);
  }
  return w;
}

function guessPos(
  token: string,
  prev: Token | null,
  isLineStart: boolean,
): PosTag {
  const lower = token.toLowerCase();
  if (/^\d+([.,]\d+)?%?\w*$/.test(token) && /\d/.test(token)) return "NUM";
  if (/^[A-Z][a-z]/.test(token) && !isLineStart) return "PROPN";
  if (/^[A-Z]{2,}$/.test(token) && token.length <= 6) return "PROPN"; // acronyms: AWS, SQL
  if (lower.endsWith("ly") && lower.length > 4) return "ADV";
  if (
    COMMON_VERBS.has(lower) ||
    COMMON_VERBS.has(lemmatize(lower)) ||
    (lower.endsWith("ed") && !lower.endsWith("eed")) ||
    (lower.endsWith("ing") && prev?.lower !== "of")
  )
    return "VERB";
  if (
    lower.endsWith("ive") ||
    lower.endsWith("ous") ||
    lower.endsWith("ful") ||
    lower.endsWith("able") ||
    lower.endsWith("ible") ||
    lower.endsWith("al") ||
    lower.endsWith("ic")
  )
    return "ADJ";
  return "NOUN";
}

/* Tokens to keep as single units even though they contain punctuation */
function isTechCompound(t: string): boolean {
  return (
    /^[a-z][a-z0-9]*(?:[.+#][a-z0-9+#]+)+$/i.test(t) || // node.js, c++, c#, .net, scikit-learn
    /^[a-z]-[a-z0-9-]+$/i.test(t) // full-stack, ci-cd
  );
}

function splitSentences(text: string): string[][] {
  const lines = text.split(/\n+/);
  const sentenceStrings: string[] = [];
  for (const line of lines) {
    const parts = line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/);
    for (const p of parts) {
      const t = p.trim();
      if (t) sentenceStrings.push(t);
    }
  }
  return sentenceStrings.map((s) => tokenizeString(s));
}

function tokenizeString(s: string): string[] {
  // protect tech compounds, otherwise split punctuation from words
  return s
    .split(/\s+/)
    .flatMap((piece) => {
      if (!piece) return [];
      if (isTechCompound(piece)) return [piece];
      // split leading/trailing punctuation but keep inner hyphens & tech chars
      const matches = piece.match(
        /[A-Za-z0-9]+(?:[#'+.-][A-Za-z0-9]+)*|[^\sA-Za-z0-9]/g,
      );
      return matches ?? [];
    })
    .filter(Boolean);
}

export function processDocument(raw: string): ProcessedDoc {
  const cleaned = cleanText(raw);
  const sentenceStrings = splitSentences(cleaned.text);

  const sentences: Token[][] = [];
  const tokens: Token[] = [];

  for (const sTokens of sentenceStrings) {
    const sent: Token[] = [];
    let prev: Token | null = null;
    sTokens.forEach((text, i) => {
      const isPunct = /^[^\w]+$/.test(text);
      const isAlpha = /[A-Za-z]/.test(text);
      const lower = text.toLowerCase();
      const token: Token = {
        text,
        lower,
        lemma: isAlpha ? lemmatize(text) : lower,
        pos: isPunct ? "X" : guessPos(text, prev, i === 0),
        isStop: isAlpha && STOPWORDS.has(lower),
        isPunct,
        isAlpha,
        isLineStart: i === 0,
      };
      sent.push(token);
      tokens.push(token);
      if (!isPunct) prev = token;
    });
    if (sent.length) sentences.push(sent);
  }

  const filteredTokens = tokens.filter(
    (t) =>
      !t.isPunct &&
      t.isAlpha &&
      (!t.isStop || t.lower === "r" || /^[A-Z]{2,}$/.test(t.text)) &&
      t.lower.length > 1,
  );

  const lemmas = filteredTokens.map((t) => t.lemma);
  const lemmaSet = new Set(lemmas);

  // Noun phrases: consecutive ADJ/NOUN/PROPN runs (length ≥ 2)
  const nounPhrases: string[] = [];
  for (const sent of sentences) {
    let run: string[] = [];
    const flush = () => {
      if (run.length >= 2 && run.length <= 6) {
        const phrase = run.join(" ").toLowerCase();
        if (!phrase.split(" ").every((w) => STOPWORDS.has(w))) {
          nounPhrases.push(phrase);
        }
      }
      run = [];
    };
    for (const t of sent) {
      if ((t.pos === "NOUN" || t.pos === "PROPN" || t.pos === "ADJ") && !t.isPunct) {
        run.push(t.lemma !== t.lower ? t.lemma : t.lower);
      } else {
        flush();
      }
    }
    flush();
  }

  const posDistribution: Record<string, number> = {};
  for (const t of tokens) {
    if (t.isPunct) continue;
    posDistribution[t.pos] = (posDistribution[t.pos] ?? 0) + 1;
  }

  return {
    raw,
    cleaned,
    sentences,
    tokens,
    filteredTokens,
    lemmas,
    lemmaSet,
    nounPhrases: Array.from(new Set(nounPhrases)),
    wordCount: tokens.filter((t) => !t.isPunct).length,
    uniqueTokenCount: lemmaSet.size,
    posDistribution,
  };
}
