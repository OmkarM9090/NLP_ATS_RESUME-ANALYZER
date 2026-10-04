import type {
  JDEntities,
  ResumeEntities,
  ContactInfo,
} from "@/types/analysis";
import type { ProcessedDoc } from "./tokenizer";
import { parseSections } from "./section-parser";
import { extractSkillsFromText } from "./skill-matcher";

/* ------------------------------------------------------------------
 * NER layer — spaCy-style entity extraction using pattern, gazetteer
 * and layout heuristics: PERSON, ORG, GPE, DATE, DEGREE, CERTIFICATION.
 * ------------------------------------------------------------------ */

const BIG_TECH_GAZETTEER = [
  "Google","Alphabet","Meta","Facebook","Amazon","AWS","Microsoft","Apple",
  "Netflix","Tesla","IBM","Oracle","Salesforce","Adobe","Intel","NVIDIA",
  "AMD","Uber","Lyft","Airbnb","Stripe","Shopify","Spotify","Twitter","X Corp",
  "LinkedIn","Snap","Pinterest","TikTok","ByteDance","Samsung","Sony","Dell",
  "HP","Cisco","VMware","Palantir","Snowflake","Databricks","OpenAI","Anthropic",
  "Vercel","Atlassian","Twilio","Datadog","Cloudflare","GitHub","GitLab",
  "JPMorgan","Goldman Sachs","Morgan Stanley","Deloitte","Accenture","McKinsey",
  "KPMG","PwC","EY","MIT","Stanford","Harvard","Berkeley","CMU","Caltech",
];

const ORG_SUFFIX_RE =
  /(?:^|[ \t\n])([A-Z][\w&',.-]*(?:[ \t]+[A-Z][\w&',.-]*){0,4}[ \t]+(?:Inc|Corp|Corporation|Company|Co|LLC|LLP|Ltd|Limited|GmbH|Technologies|Technology|Tech|Labs|Laboratories|Systems|Solutions|Group|Holdings|Partners|Ventures|Capital|Networks|Software|Analytics|AI|Cloud|Digital|Studios|Industries|Enterprises|Consulting|Services|University|College|Institute|Institute of Technology|School|Academy|Hospital|Bank|Agency))(?![\w])/g;

const LOCATION_RE =
  /\b([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+(?:land|shire|ylvania|inia|ota|ado|igan|etti|ton))\b/g;

const US_STATE_LIKE = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const DATE_RANGE_RE = new RegExp(
  `(?:(?:${MONTHS})[\\s.,]*)?(19|20)\\d{2}\\s*(?:[-–—]|to)\\s*(?:(?:(?:${MONTHS})[\\s.,]*)?(?:(?:19|20)\\d{2}|present|current|now))`,
  "gi",
);

export interface DegreeHit {
  degree: string;
  level: number; // 5=PhD 4=Master 3=Bachelor 2=Associate 1=Diploma/Cert 0=none
}

const DEGREE_PATTERNS: Array<{ re: RegExp; level: number }> = [
  { re: /\b(?:ph\.?\s?d\.?|doctorate|doctoral)\b[^,.\n]{0,50}/gi, level: 5 },
  { re: /\b(?:master(?:'s)?(?:\s+of\s+\w+(?:\s+\w+)?)?|m\.?s\.?(?:\s+in\s+[\w &]+)?|meng|m\.?eng\.?|mba|m\.?b\.?a\.?|m\.?a\.?(?:\s+in\s+[\w &]+)?)\b[^,.\n]{0,40}/gi, level: 4 },
  { re: /\b(?:bachelor(?:'s)?(?:\s+of\s+\w+(?:\s+\w+)?)?|b\.?s\.?(?:\s+in\s+[\w &]+)?|b\.?a\.?(?:\s+in\s+[\w &]+)?|btech|b\.?tech\.?|beng|b\.?eng\.?|undergraduate degree)\b[^,.\n]{0,40}/gi, level: 3 },
  { re: /\b(?:associate(?:'s)?(?:\s+(?:of|degree)\s*\w*)?)\b[^,.\n]{0,30}/gi, level: 2 },
  { re: /\b(?:diploma|bootcamp|nanodegree)\b[^,.\n]{0,30}/gi, level: 1 },
];

const CERT_PATTERNS: RegExp[] = [
  /\b(?:aws|azure|gcp|google cloud)\s+certified[\w\s®™-]{0,40}/gi,
  /\baws certified [\w-]+(?:\s+[\w-]+){0,3}/gi,
  /\b(?:solutions architect|developer|sysops)\s+(?:associate|professional)\b/gi,
  /\bcertified\s+[\w\s-]{2,35}(?:professional|associate|expert|architect|developer|engineer|specialist)?/gi,
  /\b(?:pmp|ccna|cissp|cism|comptia\s+\w+\+?|cka|ckad|cfa|cpa|scrum master(?:\s+certification)?|csm|psm|itil|six sigma(?:\s+\w+)?|leed|rhce|ocp|mcsa)\b/gi,
  /\b[\w\s+.#-]{2,35}\s+certification\b/gi,
];

export function extractDegrees(text: string): DegreeHit[] {
  const hits: DegreeHit[] = [];
  for (const { re, level } of DEGREE_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const deg = m[0].replace(/\s+/g, " ").trim();
      if (deg.length >= 2 && deg.length <= 80) hits.push({ degree: deg, level });
    }
  }
  // dedupe by lowercase
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = h.degree.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function highestEducationLevel(degrees: DegreeHit[]): number {
  return degrees.reduce((max, d) => Math.max(max, d.level), 0);
}

export function extractCertifications(text: string): string[] {
  const found = new Set<string>();
  for (const re of CERT_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const c = m[0].replace(/\s+/g, " ").trim();
      if (c.length > 2 && c.length < 60 && !/^(the|a|an)\s/i.test(c)) {
        found.add(c.charAt(0).toUpperCase() + c.slice(1));
      }
    }
  }
  return Array.from(found).slice(0, 12);
}

export function extractOrganizations(text: string): string[] {
  const skip = new Set(["Inc", "LLC", "Ltd", "Co"]);
  const found: string[] = [];
  const seen = new Set<string>();

  // Suffix-pattern matches first — most reliable company signal
  for (const m of text.matchAll(new RegExp(ORG_SUFFIX_RE.source, ORG_SUFFIX_RE.flags))) {
    const org = m[1].replace(/\s+/g, " ").trim();
    const key = org.toLowerCase();
    if (
      org.length >= 4 &&
      org.length <= 60 &&
      !skip.has(org) &&
      !/^(dear|sincerely|best)\b/i.test(org) &&
      !seen.has(key)
    ) {
      seen.add(key);
      found.push(org);
    }
  }
  for (const name of BIG_TECH_GAZETTEER) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(text) && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      found.push(name);
    }
  }
  return found.slice(0, 15);
}

export function extractLocations(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(new RegExp(LOCATION_RE.source, LOCATION_RE.flags))) {
    const state = m[2];
    if (US_STATE_LIKE.has(state) || /^[A-Z][a-z]+$/.test(state)) {
      found.add(`${m[1]}, ${state}`);
    }
  }
  if (/\bremote\b/i.test(text)) found.add("Remote");
  if (/\bhybrid\b/i.test(text)) found.add("Hybrid");
  return Array.from(found).slice(0, 8);
}

export interface DateRange {
  label: string;
  startYear: number;
  endYear: number; // current year if ongoing
  ongoing: boolean;
}

export function extractDateRanges(text: string): DateRange[] {
  const ranges: DateRange[] = [];
  const nowY = new Date().getFullYear();
  for (const m of text.matchAll(new RegExp(DATE_RANGE_RE.source, DATE_RANGE_RE.flags))) {
    const label = m[0].trim();
    const years = Array.from(label.matchAll(/(?:19|20)\d{2}/g)).map((y) => parseInt(y[0], 10));
    const ongoing = /present|current|now/i.test(label);
    if (years.length >= 1) {
      const startYear = years[0];
      const endYear = ongoing ? nowY : years.length >= 2 ? years[1] : nowY;
      if (startYear >= 1970 && startYear <= nowY && endYear >= startYear && endYear - startYear <= 40) {
        ranges.push({ label, startYear, endYear, ongoing });
      }
    }
  }
  return ranges.slice(0, 12);
}

export function estimateYearsOfExperience(text: string): number | null {
  // Explicit claim: "7+ years of experience"
  const explicit = text.match(/(\d{1,2})\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+|relevant\s+)?(?:experience|exp\b)/i);
  if (explicit) {
    const y = parseInt(explicit[1], 10);
    if (y >= 1 && y <= 45) return y;
  }
  const ranges = extractDateRanges(text).filter((r) => r.endYear - r.startYear >= 1);
  if (!ranges.length) return null;
  const minStart = Math.min(...ranges.map((r) => r.startYear));
  const maxEnd = Math.max(...ranges.map((r) => r.endYear));
  const total = Math.min(45, maxEnd - minStart);
  return total >= 1 ? total : null;
}

export function extractRequiredYears(jdText: string): number | null {
  const re = /(\d{1,2})\s*\+?\s*years?/gi;
  let best: number | null = null;
  for (const m of jdText.matchAll(re)) {
    const y = parseInt(m[1], 10);
    if (y >= 1 && y <= 20) {
      // prefer mentions near requirement-ish words
      const ctx = jdText.slice(Math.max(0, m.index! - 80), m.index! + 60).toLowerCase();
      const weighted = /(experience|minimum|require|qualification|exp\b)/.test(ctx);
      const val = weighted ? y : y;
      if (best === null || (weighted && val > (best ?? 0)) || (!weighted && best === null)) {
        best = val;
      }
    }
  }
  return best;
}

export function extractPerson(firstBlock: string): string | null {
  const lines = firstBlock
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  for (const line of lines) {
    if (/@|http|www\.|\d{3}|resume|curriculum vitae|cv\b/i.test(line)) continue;
    const words = line.split(/\s+/).filter((w) => /^[A-Za-z.'-]+$/.test(w));
    if (words.length >= 2 && words.length <= 4 && line.length <= 42) {
      const capitalized = words.filter((w) => /^[A-Z][a-z.'-]+$|^[A-Z]\.$/.test(w));
      const isShoutName = words.every((w) => /^[A-Z.'-]{2,}$/.test(w));
      if (capitalized.length === words.length || isShoutName) {
        return words
          .map((w) => (isShoutName ? w[0] + w.slice(1).toLowerCase() : w))
          .join(" ");
      }
    }
  }
  return null;
}

/* -------------------- resume-level extraction -------------------- */

export function extractResumeEntities(doc: ProcessedDoc): ResumeEntities {
  const text = doc.cleaned.text;
  const contacts: ContactInfo = doc.cleaned.contacts;
  const dateRanges = extractDateRanges(text);
  const degrees = extractDegrees(text);

  return {
    person: extractPerson(text.split(/\n\n/)[0] ?? text.slice(0, 300)),
    organizations: extractOrganizations(text),
    locations: extractLocations(text),
    dates: dateRanges.map((r) => r.label),
    skills: extractSkillsFromText(text),
    certifications: extractCertifications(text),
    degrees: degrees
      .sort((a, b) => b.level - a.level)
      .map((d) => d.degree)
      .slice(0, 6),
    contacts,
    years_of_experience: estimateYearsOfExperience(text),
  };
}

/* --------------------- JD-level extraction ----------------------- */

const PREFERRED_SPLIT_RE =
  /(?:^|\n)\s*(?:preferred|nice[- ]to[- ]have|bonus|plus|desired|advantageous)(?:\s+(?:qualifications|skills|requirements))?\s*[:\-]?\s*/im;

export function extractJDEntities(jdDoc: ProcessedDoc): JDEntities {
  const text = jdDoc.cleaned.text;

  const splitMatch = text.match(PREFERRED_SPLIT_RE);
  let requiredText = text;
  let preferredText = "";
  if (splitMatch && splitMatch.index !== undefined) {
    requiredText = text.slice(0, splitMatch.index);
    preferredText = text.slice(splitMatch.index);
  } else {
    // Fallback: sentences containing "preferred/nice to have/plus"
    const prefLines: string[] = [];
    const reqLines: string[] = [];
    for (const line of text.split(/\n/)) {
      if (/preferred|nice to have|bonus|a big plus|is a plus/i.test(line)) prefLines.push(line);
      else reqLines.push(line);
    }
    requiredText = reqLines.join("\n");
    preferredText = prefLines.join("\n");
  }

  const degrees = extractDegrees(text);
  const topDegree = degrees.sort((a, b) => b.level - a.level)[0];
  const requiredYears = extractRequiredYears(text);
  const orgs = extractOrganizations(text);
  const sections = parseSections(text);

  return {
    organization: orgs[0] ?? null,
    location: extractLocations(text)[0] ?? null,
    required_skills: extractSkillsFromText(requiredText),
    preferred_skills: extractSkillsFromText(preferredText),
    degree_requirement: topDegree ? topDegree.degree : null,
    experience_requirement: requiredYears ? `${requiredYears}+ years` : null,
    required_years: requiredYears,
  };
}

export { parseSections };
