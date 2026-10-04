"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, CheckCircle2, FileSearch, FileText, Loader2 } from "lucide-react";
import { gsap } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: FileText, label: "Extracting text from both documents" },
  { icon: Brain, label: "Running the NLP pipeline" },
  { icon: FileSearch, label: "Scoring similarity across five signals" },
  { icon: CheckCircle2, label: "Composing your report" },
];

export default function AnalysisLoader({
  open,
  step,
  progress,
}: {
  open: boolean;
  step: number;
  progress: number;
}) {
  const R = 34;
  const CIRC = 2 * Math.PI * R;

  /* Animated progress arc + shimmering skeleton lines while open. */
  useEffect(() => {
    if (!open) return;
    const ctx = gsap.context(() => {
      gsap.set(".al-arc", { strokeDasharray: CIRC, strokeDashoffset: CIRC });
      gsap.to(".al-arc", {
        strokeDashoffset: CIRC * (1 - Math.max(progress, 4) / 100),
        duration: 0.9,
        ease: "power2.out",
        overwrite: true,
      });
      gsap.fromTo(
        ".al-row",
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.08, delay: 0.1 },
      );
      gsap.fromTo(
        ".al-skeleton span",
        { scaleX: 0.2, opacity: 0.3 },
        {
          scaleX: 1,
          opacity: 1,
          duration: 1.1,
          stagger: 0.12,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        },
      );
    });
    return () => ctx.revert();
  }, [open, progress, CIRC]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-void/85 px-5 backdrop-blur-2xl"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.94, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="card relative w-[min(94vw,460px)] overflow-hidden rounded-3xl p-7 sm:p-8"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-[70px]" />

            <div className="relative flex items-center gap-5">
              <div className="relative flex h-[86px] w-[86px] shrink-0 items-center justify-center">
                <svg viewBox="0 0 86 86" className="absolute inset-0 -rotate-90">
                  <circle
                    cx="43"
                    cy="43"
                    r={R}
                    fill="none"
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth="4"
                  />
                  <circle
                    className="al-arc"
                    cx="43"
                    cy="43"
                    r={R}
                    fill="none"
                    stroke="url(#al-grad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="al-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#8D7BFF" />
                      <stop offset="100%" stopColor="#24D3B4" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="font-mono text-[15px] font-bold tabular-nums text-ink">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="min-w-0">
                <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                  Analyzing your documents
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist">
                  Fourteen stages, five weighted signals — usually a couple of
                  seconds.
                </p>
              </div>
            </div>

            <div className="relative mt-7 space-y-3">
              {STEPS.map(({ icon: Icon, label }, i) => {
                const state = i < step ? "done" : i === step ? "active" : "todo";
                return (
                  <div key={label} className="al-row flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-all duration-500",
                        state === "done" && "bg-success/12 text-success ring-success/30",
                        state === "active" &&
                          "bg-primary/15 text-primary-2 ring-primary/35",
                        state === "todo" && "bg-white/[0.03] text-faint ring-white/[0.07]",
                      )}
                    >
                      {state === "active" ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                      ) : (
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[13.5px] transition-colors duration-500",
                        state === "todo" ? "text-faint" : "text-ink/90",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="al-skeleton mt-7 space-y-2">
              {[88, 64, 76].map((w, i) => (
                <span
                  key={i}
                  className="block h-1.5 origin-left rounded-full bg-white/[0.05]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
