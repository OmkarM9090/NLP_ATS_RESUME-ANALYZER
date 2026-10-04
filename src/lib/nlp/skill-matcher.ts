import {
  getAliasMap,
  getCategoryFor,
  ALL_CANONICAL_SKILLS,
} from "./data/skill-taxonomy";
import type { SkillsAnalysis, PartialSkillMatch } from "@/types/analysis";

/* ------------------------------------------------------------------
 * Skill matcher — taxonomy + alias resolution, exact / fuzzy (dice
 * bigram) matching between resume and JD skill sets.
 * ------------------------------------------------------------------ */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Boundary-aware matcher that works for tricky tokens like "C++" / "C#". */
function aliasInText(alias: string, lowerText: string): boolean {
  const pattern = `(?<![A-Za-z0-9+#.])${escapeRegExp(alias)}(?![A-Za-z0-9+#])`;
  return new RegExp(pattern, "i").test(lowerText);
}

/** Scan raw text and resolve every taxonomy skill mentioned in it. */
export function extractSkillsFromText(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const aliasMap = getAliasMap();
  const found = new Map<string, number>(); // canonical -> first index

  for (const [alias, entry] of aliasMap) {
    const idx = lower.indexOf(alias);
    if (idx === -1) continue;
    if (!aliasInText(alias, lower)) continue;
    if (!found.has(entry.canonical)) {
      found.set(entry.canonical, idx);
    }
  }

  return Array.from(found.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([canonical]) => canonical);
}

/** Sørensen–Dice coefficient over character bigrams. */
export function diceSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams.get(bg);
    if (count && count > 0) {
      overlap++;
      bigrams.set(bg, count - 1);
    }
  }
  return (2 * overlap) / (s1.length - 1 + (s2.length - 1));
}

function normalizeSkillName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchSkills(
  resumeSkills: string[],
  jdSkills: string[],
): SkillsAnalysis {
  const resumeSet = new Set(resumeSkills);
  const jdSet = new Set(jdSkills);

  const matched = jdSkills.filter((s) => resumeSet.has(s));
  const missingAfterExact = jdSkills.filter((s) => !resumeSet.has(s));
  const usedResume = new Set(matched);

  // Fuzzy / partial matching between different canonical names
  const partial: PartialSkillMatch[] = [];
  const missing: string[] = [];

  for (const jdSkill of missingAfterExact) {
    let best: { resume: string; sim: number } | null = null;
    for (const rSkill of resumeSkills) {
      if (usedResume.has(rSkill)) continue;
      const sim = diceSimilarity(normalizeSkillName(jdSkill), normalizeSkillName(rSkill));
      if (sim >= 0.72 && (best === null || sim > best.sim)) {
        best = { resume: rSkill, sim };
      }
    }
    if (best && best.sim >= 0.72) {
      // require at least moderate confidence to qualify as "partial"
      if (best.sim >= 0.78) {
        partial.push({
          resume: best.resume,
          jd: jdSkill,
          similarity: Math.round(best.sim * 100) / 100,
        });
        usedResume.add(best.resume);
        continue;
      }
    }
    missing.push(jdSkill);
  }

  const partialResumeNames = new Set(partial.map((p) => p.resume));
  const extra = resumeSkills.filter(
    (s) => !jdSet.has(s) && !partialResumeNames.has(s),
  );

  return { matched, missing, partial, extra };
}

export function skillCoverage(skills: SkillsAnalysis, jdSkillCount: number): number {
  if (jdSkillCount === 0) return 0;
  const partialCredit = skills.partial.reduce((sum, p) => sum + p.similarity, 0);
  return (skills.matched.length + 0.8 * partialCredit) / jdSkillCount;
}

export function skillsByCategory(skills: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of skills) {
    const cat = getCategoryFor(s);
    (out[cat] ??= []).push(s);
  }
  return out;
}

export { ALL_CANONICAL_SKILLS };
