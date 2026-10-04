"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain, CheckCircle2, FileSearch, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: FileText, label: "Extracting text from documents" },
  { icon: Brain, label: "Running the NLP pipeline" },
  { icon: FileSearch, label: "Computing similarity scores" },
  { icon: CheckCircle2, label: "Generating your report" },
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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-night/90 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong w-[min(92vw,440px)] rounded-3xl p-8"
          >
            <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:1.8s]" />
              <span className="absolute inset-0 rounded-full bg-primary/10" />
              <Loader2 className="h-9 w-9 animate-spin text-primary" strokeWidth={2.2} />
            </div>

            <h3 className="text-center font-display text-xl font-semibold">
              Analyzing your documents
            </h3>
            <p className="mt-1.5 text-center text-xs text-mist">
              Running 12 pipeline stages — usually takes a few seconds
            </p>

            <div className="mt-7 space-y-3.5">
              {STEPS.map(({ icon: Icon, label }, i) => {
                const state = i < step ? "done" : i === step ? "active" : "todo";
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-500",
                        state === "done" && "border-success/40 bg-success/15 text-success",
                        state === "active" && "animate-pulse-soft border-primary/50 bg-primary/15 text-primary",
                        state === "todo" && "border-line bg-white/[0.02] text-mist/50",
                      )}
                    >
                      {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span
                      className={cn(
                        "text-sm transition-colors duration-500",
                        state === "done" && "text-mist line-through decoration-white/20",
                        state === "active" && "font-medium text-ink",
                        state === "todo" && "text-mist/50",
                      )}
                    >
                      {label}
                      {state === "active" && "…"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-7">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full gradient-1 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round(progress)}%` }}
                />
              </div>
              <p className="mt-2 text-right font-mono text-[11px] text-mist">
                {Math.round(progress)}%
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
