"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Info, Shuffle, XCircle } from "lucide-react";
import type { SkillsAnalysis } from "@/types/analysis";
import { Badge } from "@/components/ui/primitives";

const item = {
  hidden: { opacity: 0, y: 14, scale: 0.94 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.03 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function SkillsPanel({ skills }: { skills: SkillsAnalysis }) {
  const total = skills.matched.length + skills.missing.length + skills.partial.length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 font-mono text-xs text-mist">
        <Badge tone="success">{skills.matched.length} matched</Badge>
        <Badge tone="danger">{skills.missing.length} missing</Badge>
        <Badge tone="warning">{skills.partial.length} partial</Badge>
        <span className="text-mist/60">{total} JD skills detected</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Matched skills
          </h3>
          {skills.matched.length ? (
            <div className="flex flex-wrap gap-2">
              {skills.matched.map((s, i) => (
                <motion.span
                  key={s}
                  custom={i}
                  variants={item}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  className="rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 font-mono text-xs text-emerald-300"
                >
                  {s}
                </motion.span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mist">No exact skill matches detected. Review the JD's required stack.</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-danger">
            <XCircle className="h-4 w-4" /> Missing from resume
          </h3>
          {skills.missing.length ? (
            <div className="flex flex-wrap gap-2">
              {skills.missing.map((s, i) => (
                <motion.span
                  key={s}
                  custom={i}
                  variants={item}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 font-mono text-xs text-red-300"
                >
                  {s}
                </motion.span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mist">Nothing missing — your resume covers every JD skill found.</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-warning">
            <Shuffle className="h-4 w-4" /> Partial matches
          </h3>
          {skills.partial.length ? (
            <div className="space-y-2.5">
              {skills.partial.map((p, i) => (
                <motion.div
                  key={`${p.resume}-${p.jd}`}
                  custom={i}
                  variants={item}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  className="rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2"
                >
                  <p className="font-mono text-xs text-amber-300">
                    {p.resume} ↔ {p.jd}
                  </p>
                  <p className="mt-0.5 text-[10px] text-mist">
                    terminology differs · {Math.round(p.similarity * 100)}% similar
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mist">No near-matches — skills either matched exactly or are fully absent.</p>
          )}
        </div>
      </div>

      {skills.extra.length > 0 && (
        <div className="mt-5 glass rounded-2xl p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-mist">
            <Info className="h-4 w-4 text-secondary" /> Extra skills on your resume
            <span className="font-mono text-[10px] text-mist/60">(not referenced by this JD)</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {skills.extra.map((s, i) => (
              <motion.span
                key={s}
                custom={i}
                variants={item}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-40px" }}
                className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 font-mono text-xs text-mist"
              >
                {s}
              </motion.span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
