/* ------------------------------------------------------------------
 * Resume section parser — detects standard resume sections using
 * header-alias matching + typographic heuristics (ALL-CAPS short lines,
 * heading-colon patterns, lines directly above content blocks).
 * ------------------------------------------------------------------ */

export const SECTION_HEADERS: Record<string, string[]> = {
  summary: ["summary", "professional summary", "objective", "career objective", "profile", "professional profile", "about", "about me", "executive summary", "overview"],
  experience: ["experience", "work experience", "work history", "employment", "employment history", "professional experience", "professional background", "career history", "relevant experience", "work"],
  education: ["education", "education and training", "academic background", "academic qualifications", "qualifications", "degrees", "academics"],
  skills: ["skills", "technical skills", "core skills", "key skills", "competencies", "core competencies", "technologies", "tech stack", "technical proficiencies", "tools", "areas of expertise", "expertise"],
  projects: ["projects", "personal projects", "key projects", "selected projects", "portfolio", "work samples", "side projects"],
  certifications: ["certifications", "certificates", "licenses", "licenses and certifications", "credentials", "professional certifications"],
  awards: ["awards", "honors", "achievements", "awards and honors", "accomplishments"],
  languages: ["languages", "language proficiency", "spoken languages"],
  publications: ["publications", "papers", "research", "research publications"],
  volunteering: ["volunteering", "volunteer experience", "community"],
  interests: ["interests", "hobbies", "activities"],
  references: ["references"],
};

// alias (normalized) -> section
const ALIAS_TO_SECTION = new Map<string, string>();
for (const [section, aliases] of Object.entries(SECTION_HEADERS)) {
  for (const alias of aliases) ALIAS_TO_SECTION.set(alias, section);
}

function normalizeHeaderCandidate(line: string): string {
  return line
    .toLowerCase()
    .replace(/[:\-|•·*_\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHeader(raw: string): boolean {
  const line = raw.trim();
  if (!line || line.length > 48) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const norm = normalizeHeaderCandidate(line);
  if (ALIAS_TO_SECTION.has(norm)) return true;
  // shouty short line that fuzzy-contains a known alias
  const isShouty = letters === letters.toUpperCase() && letters.length <= 40;
  if (isShouty) {
    for (const alias of ALIAS_TO_SECTION.keys()) {
      if (norm === alias || (alias.length >= 5 && norm.includes(alias))) return true;
    }
  }
  // "SKILLS:" style ending with colon
  if (/:$/.test(line)) {
    for (const alias of ALIAS_TO_SECTION.keys()) {
      if (norm === alias || norm.endsWith(" " + alias)) return true;
    }
  }
  return false;
}

function sectionForLine(raw: string): string | null {
  const norm = normalizeHeaderCandidate(raw.trim());
  if (ALIAS_TO_SECTION.has(norm)) return ALIAS_TO_SECTION.get(norm)!;
  for (const alias of ALIAS_TO_SECTION.keys()) {
    if (alias.length >= 5 && norm.includes(alias)) return ALIAS_TO_SECTION.get(alias)!;
  }
  return null;
}

export interface ParsedSections {
  sections: Record<string, string>;
  detected: string[];
}

export function parseSections(text: string): ParsedSections {
  const lines = text.split(/\n/);
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    if (looksLikeHeader(line)) {
      const sec = sectionForLine(line);
      if (sec) {
        current = sec;
        if (!sections[sec]) sections[sec] = [];
        continue;
      }
    }
    if (current) {
      sections[current].push(line);
    }
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sections)) {
    const joined = v.join("\n").trim();
    if (joined.length > 0) out[k] = joined;
  }

  // Fallback heuristics: if no skills section was detected but a short-list
  // region exists, we leave it — the skill matcher operates on full text.
  return { sections: out, detected: Object.keys(out) };
}
