import type { ContactInfo } from "@/types/analysis";

export interface CleanedText {
  text: string;
  contacts: ContactInfo;
}

const LIGATURES: Record<string, string> = {
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬀ": "ff",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "–": "-",
  "—": "-",
  "•": "\n• ",
  "·": " ",
  "→": " ",
  "↦": " ",
  "▪": "\n• ",
  "◦": "\n• ",
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>)"']+|(?:linkedin\.com|github\.com|gitlab\.com|bitbucket\.org|portfolio\.dev)\/[^\s<>)"']*/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]\d{3,4}(?:[\s.-]\d{3,4})?/g;

export function cleanText(raw: string): CleanedText {
  let text = raw.normalize("NFKD");

  for (const [k, v] of Object.entries(LIGATURES)) {
    text = text.split(k).join(v);
  }

  // Extract & strip contact artifacts (stored separately for the entity layer)
  const emails = Array.from(new Set(text.match(EMAIL_RE) ?? []));
  const urls = Array.from(new Set(text.match(URL_RE) ?? [])).slice(0, 10);
  const phones = Array.from(
    new Set(
      (text.match(PHONE_RE) ?? [])
        .map((p) => p.trim())
        .filter((p) => p.replace(/\D/g, "").length >= 7),
    ),
  ).slice(0, 5);

  text = text.replace(EMAIL_RE, " ");
  text = text.replace(URL_RE, " ");
  text = text.replace(PHONE_RE, " ");

  // Repair words hyphenated across line breaks: "develop-\nment" → "development"
  text = text.replace(/([A-Za-z])-\s*\n\s*([a-z])/g, "$1$2");

  // Normalize spaced hyphens inside compound words: "full - stack" → "full-stack"
  // (only when the right side is lowercase — "Inc — San" is a separator, not a compound)
  text = text.replace(/([A-Za-z])\s+-\s+([a-z])/g, "$1-$2");

  // Strip control chars & odd symbols, preserving tech-meaningful chars
  // (alphanumerics, whitespace, + # . / - ' & : ; , ( ) | and newlines)
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  text = text.replace(/[^\S\n]+/g, " ");
  text = text.replace(/\|[ \t]*\|/g, " "); // collapse table pipes
  text = text.replace(/[\u2013\u2014\u2212]/g, "-");

  // Collapse 3+ newlines → paragraph break
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return {
    text,
    contacts: { emails, phones, urls },
  };
}
