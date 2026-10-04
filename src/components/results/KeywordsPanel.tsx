"use client";

import { motion } from "framer-motion";
import type { JDKeyword } from "@/types/analysis";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export default function KeywordsPanel({ keywords }: { keywords: JDKeyword[] }) {
  if (!keywords.length) return null;

  const found = keywords.filter((k) => k.found_in_resume).length;
  const maxScore = Math.max(...keywords.map((k) => k.tfidf_score), 0.001);

  return (
    <div className="glass rounded-2xl p-6 sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Top JD keywords</h3>
          <p className="mt-1 text-xs text-mist">
            Ranked by TF-IDF + RAKE importance. Size = weight in the posting.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="success">{found} in resume</Badge>
          <Badge tone="danger">{keywords.length - found} missing</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5 py-2">
        {keywords.map((k, i) => {
          const t = k.tfidf_score / maxScore;
          const size = 0.78 + t * 1.15;
          return (
            <motion.span
              key={k.keyword}
              title={
                k.found_in_resume
                  ? `“${k.keyword}” found in your resume · weight ${k.tfidf_score.toFixed(2)}`
                  : `“${k.keyword}” is missing from your resume · weight ${k.tfidf_score.toFixed(2)}`
              }
              initial={{ opacity: 0, scale: 0.7 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: 0.02 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontSize: `${size.toFixed(2)}rem` }}
              className={cn(
                "cursor-default rounded-lg border px-2.5 py-1 font-medium leading-tight transition-transform duration-200 hover:scale-110",
                k.found_in_resume
                  ? "border-success/25 bg-success/[0.08] text-emerald-300"
                  : "border-danger/25 bg-danger/[0.08] text-red-300",
              )}
            >
              {k.keyword}
            </motion.span>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-6 border-t border-line/50 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" /> present in resume
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-danger" /> missing
        </span>
      </div>
    </div>
  );
}
