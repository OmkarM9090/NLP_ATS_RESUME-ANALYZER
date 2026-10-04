"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Timer,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import FileUploadZone, {
  validateUploadFile,
} from "@/components/analyze/FileUploadZone";
import AnalysisLoader from "@/components/analyze/AnalysisLoader";
import { Button } from "@/components/ui/primitives";
import { analyzeDocuments, analyzeSample } from "@/lib/api";
import { useAnalysisStore } from "@/stores/analysisStore";
import { gsap, revealOnScroll } from "@/lib/anim";

const STEP_TIMELINE: Array<{ at: number; step: number; progress: number }> = [
  { at: 0, step: 0, progress: 8 },
  { at: 900, step: 1, progress: 34 },
  { at: 2100, step: 2, progress: 63 },
  { at: 3300, step: 3, progress: 87 },
];
const MIN_DURATION_MS = 4500;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PIPELINE_FACTS = [
  { icon: FileText, text: "PDF, DOCX and TXT, validated before parsing" },
  { icon: Wand2, text: "14 stages — tokenise, lemmatise, extract, rank" },
  { icon: Timer, text: "Bounded by a hard analysis timeout" },
  { icon: ShieldCheck, text: "Nothing is stored beyond the report" },
];

function AnalyzePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sampleRequested = searchParams.get("sample") === "1";
  const sampleRan = useRef(false);
  const scope = useRef<HTMLElement>(null);

  const [resume, setResume] = useState<File | null>(null);
  const [jd, setJd] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const {
    isAnalyzing,
    step,
    progress,
    startAnalysis,
    setStep,
    finishAnalysis,
    setResult,
  } = useAnalysisStore();

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-reveal]"), {
        trigger: el,
        y: 26,
        stagger: 0.08,
        start: "top 92%",
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const beginPipeline = async (call: () => ReturnType<typeof analyzeDocuments>) => {
    setFatalError(null);
    startAnalysis();
    clearTimers();
    for (const t of STEP_TIMELINE) {
      timers.current.push(setTimeout(() => setStep(t.step, t.progress), t.at));
    }

    try {
      const [result] = await Promise.all([call(), delay(MIN_DURATION_MS)]);
      clearTimers();
      finishAnalysis();
      setResult(result);
      await delay(450);
      router.push("/results");
    } catch (err) {
      clearTimers();
      useAnalysisStore.setState({ isAnalyzing: false });
      setFatalError(
        err instanceof Error
          ? err.message
          : "Analysis failed. Please try again with different files.",
      );
    }
  };

  const onAnalyze = () => {
    if (!resume || !jd || isAnalyzing) return;
    void beginPipeline(() => analyzeDocuments(resume, jd));
  };

  const onSample = () => {
    if (isAnalyzing) return;
    void beginPipeline(() => analyzeSample());
  };

  useEffect(() => {
    if (sampleRequested && !sampleRan.current) {
      sampleRan.current = true;
      onSample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleRequested]);

  const ready = Boolean(resume && jd && !resumeError && !jdError);
  const missing = [!resume, !jd].filter(Boolean).length;

  return (
    <main
      ref={scope}
      className="relative min-h-screen px-5 pb-24 pt-28 sm:px-8 lg:pt-32"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(110,86,248,0.14),transparent)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p data-reveal className="eyebrow">
              <span className="h-1 w-1 rounded-full bg-secondary" />
              new analysis
            </p>
            <h1 data-reveal className="display-3 mt-4">
              Upload both documents.
            </h1>
            <p data-reveal className="lede mt-4 text-[15.5px]">
              The pipeline reads your resume and the job posting, then returns a
              weighted match score, the exact keyword gaps and a prioritised fix
              list. Nothing is shared or used for training.
            </p>
          </div>

          <Link
            href="/history"
            data-reveal
            className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist transition-all duration-300 hover:border-white/[0.16] hover:text-ink"
          >
            history
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </header>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div data-reveal>
                <p className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 font-mono text-[10px] font-bold text-primary-2">
                    1
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-mist">
                    your resume
                  </span>
                  {resume && (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                      ready
                    </span>
                  )}
                </p>
                <FileUploadZone
                  id="resume-upload"
                  label="Drop your resume"
                  sublabel="PDF, TXT or DOCX · max 10MB"
                  accent="primary"
                  file={resume}
                  error={resumeError}
                  disabled={isAnalyzing}
                  onFile={(f) => {
                    const err = validateUploadFile(f);
                    setResumeError(err);
                    setResume(err ? null : f);
                  }}
                  onClear={() => setResume(null)}
                />
              </div>

              <div data-reveal>
                <p className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-secondary/20 font-mono text-[10px] font-bold text-secondary">
                    2
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-mist">
                    job description
                  </span>
                  {jd && (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                      ready
                    </span>
                  )}
                </p>
                <FileUploadZone
                  id="jd-upload"
                  label="Drop the job posting"
                  sublabel="PDF, TXT or DOCX · paste the posting into a file"
                  accent="secondary"
                  file={jd}
                  error={jdError}
                  disabled={isAnalyzing}
                  onFile={(f) => {
                    const err = validateUploadFile(f);
                    setJdError(err);
                    setJd(err ? null : f);
                  }}
                  onClear={() => setJd(null)}
                />
              </div>
            </div>

            <div
              data-reveal
              className="card mt-6 flex flex-col items-center gap-4 p-5 sm:flex-row sm:justify-between"
            >
              <div>
                <p className="font-display text-[15px] font-semibold tracking-[-0.01em]">
                  {ready ? "Both documents ready" : `${missing} document${missing === 1 ? "" : "s"} left`}
                </p>
                <p className="mt-1 text-[12.5px] text-faint">
                  {ready
                    ? "Run the pipeline — around a second of compute."
                    : "Add a resume and a job posting to enable analysis."}
                </p>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onSample}
                  disabled={isAnalyzing}
                  className="btn btn-secondary group h-11 px-4 text-[13.5px]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-secondary" strokeWidth={2.2} />
                  Use sample pair
                </button>
                <Button
                  onClick={onAnalyze}
                  disabled={!ready || isAnalyzing}
                  size="md"
                  className="group min-w-[190px]"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" strokeWidth={2.2} />
                  )}
                  Analyze match
                  {!isAnalyzing && (
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  )}
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {fatalError && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mt-5 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/[0.06] p-5"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger" />
                  <div className="min-w-0">
                    <p className="font-display text-[14px] font-semibold">
                      Analysis failed
                    </p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-mist">
                      {fatalError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFatalError(null)}
                      className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-danger hover:underline"
                    >
                      dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ------------------------------ side rail ---------------------- */}
          <aside data-reveal className="card h-fit p-5 lg:sticky lg:top-28">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
              what happens next
            </p>
            <ul className="mt-5 space-y-4">
              {PIPELINE_FACTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] ring-1 ring-white/[0.08]">
                    <Icon className="h-3.5 w-3.5 text-mist" strokeWidth={2} />
                  </span>
                  <span className="text-[12.5px] leading-relaxed text-mist">{text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                scoring weights
              </p>
              <ul className="mt-3 space-y-2 font-mono text-[11px] text-mist">
                {[
                  ["semantic similarity", "0.30"],
                  ["keyword match", "0.25"],
                  ["skill match", "0.25"],
                  ["experience relevance", "0.10"],
                  ["education match", "0.10"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <span className="truncate">{k}</span>
                    <span className="tabular-nums text-ink/80">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <AnalysisLoader open={isAnalyzing} step={step} progress={progress} />
    </main>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary-2" />
        </main>
      }
    >
      <AnalyzePageInner />
    </Suspense>
  );
}
