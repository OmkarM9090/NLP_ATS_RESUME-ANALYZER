"use client";

import { motion } from "framer-motion";
import type { ScoreBreakdown as SB } from "@/types/analysis";
import { scoreColor } from "@/lib/utils";

const LABELS: Record<keyof SB, string> = {
  keyword_match: "Keyword match",
  semantic_similarity: "Semantic similarity",
  skill_match: "Skill match",
  experience_relevance: "Experience relevance",
  education_match: "Education match",
};

const ORDER: (keyof SB)[] = [
  "semantic_similarity",
  "keyword_match",
  "skill_match",
  "experience_relevance",
  "education_match",
];

export default function ScoreBreakdown({
  breakdown,
  keywordDensity,
}: {
  breakdown: SB;
  keywordDensity: { resume: number; jd: number };
}) {
  return (
    <div className="glass h-full rounded-2xl p-6 sm:p-7">
      <h3 className="font-display text-base font-semibold">Score breakdown</h3>
      <p className="mt-1 text-xs text-mist">Five weighted signals fuse into the overall score.</p>

      <div className="mt-6 space-y-5">
        {ORDER.map((key, i) => {
          const comp = breakdown[key];
          const color = scoreColor(comp.score);
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm text-ink/90">{LABELS[key]}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-mist/60">
                    ×{comp.weight.toFixed(2)}
                  </span>
                  <span className="font-mono text-sm font-semibold" style={{ color }}>
                    {comp.score.toFixed(1)}
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${comp.score}%` }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 1.1, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-7 border-t border-line/60 pt-5">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-mist/60">
          Domain keyword density
        </p>
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <span className="text-mist">resume&nbsp;</span>
            <span className="font-semibold text-ink">
              {(keywordDensity.resume * 100).toFixed(1)}%
            </span>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <span className="text-mist">job post&nbsp;</span>
            <span className="font-semibold text-ink">
              {(keywordDensity.jd * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
