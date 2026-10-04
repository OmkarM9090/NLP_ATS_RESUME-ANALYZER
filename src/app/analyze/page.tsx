"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import FileUploadZone, {
  validatePdfFile,
} from "@/components/analyze/FileUploadZone";
import AnalysisLoader from "@/components/analyze/AnalysisLoader";
import { Button } from "@/components/ui/primitives";
import { analyzeDocuments, analyzeSample } from "@/lib/api";
import { useAnalysisStore } from "@/stores/analysisStore";

const STEP_TIMELINE: Array<{ at: number; step: number; progress: number }> = [
  { at: 0, step: 0, progress: 8 },
  { at: 900, step: 1, progress: 34 },
  { at: 2100, step: 2, progress: 63 },
  { at: 3300, step: 3, progress: 87 },
];
const MIN_DURATION_MS = 4500;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function AnalyzePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sampleRequested = searchParams.get("sample") === "1";
  const sampleRan = useRef(false);

  const [resume, setResume] = useState<File | null>(null);
  const [jd, setJd] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [jdError, setJdError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const { isAnalyzing, step, progress, startAnalysis, setStep, finishAnalysis, setResult } =
    useAnalysisStore();

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const beginPipeline = async (
    call: () => ReturnType<typeof analyzeDocuments>,
  ) => {
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
      // brief beat so the user sees 100%
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

  const ready = resume && jd && !resumeError && !jdError;

  return (
    <main className="relative flex min-h-screen flex-col px-5 pb-24 pt-28 sm:px-8">
      <div className="pointer-events-none absolute inset-0 grid-lines [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[380px] w-[640px] -translate-x-1/2 rounded-full bg-primary/15 blur-[150px]" />

      <div className="relative mx-auto w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-xs text-mist transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Upload your <span className="gradient-text">documents</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
            Provide both PDFs — the pipeline never shares or trains on your
            files. Analysis runs in request scope and only the report is stored.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 grid gap-5 sm:grid-cols-2"
        >
          <div>
            <p className="mb-2.5 flex items-center gap-2 pl-1 font-mono text-[11px] uppercase tracking-[0.25em] text-indigo-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 text-[10px] font-bold">1</span>
              Your resume
            </p>
            <FileUploadZone
              id="resume-upload"
              label="Drop your resume PDF"
              sublabel="PDF only · max 10MB · text-based"
              accent="primary"
              file={resume}
              error={resumeError}
              disabled={isAnalyzing}
              onFile={(f) => {
                const err = validatePdfFile(f);
                setResumeError(err);
                setResume(err ? null : f);
              }}
              onClear={() => setResume(null)}
            />
          </div>
          <div>
            <p className="mb-2.5 flex items-center gap-2 pl-1 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-secondary/20 text-[10px] font-bold">2</span>
              Job description
            </p>
            <FileUploadZone
              id="jd-upload"
              label="Drop the job description PDF"
              sublabel="Export or print the posting to PDF"
              accent="secondary"
              file={jd}
              error={jdError}
              disabled={isAnalyzing}
              onFile={(f) => {
                const err = validatePdfFile(f);
                setJdError(err);
                setJd(err ? null : f);
              }}
              onClear={() => setJd(null)}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22 }}
          className="mt-9 flex flex-col items-center gap-4"
        >
          <Button
            size="lg"
            disabled={!ready || isAnalyzing}
            onClick={onAnalyze}
            magnetic
            className="group min-w-[260px]"
          >
            <UploadCloud className="h-4.5 w-4.5" />
            Analyze match
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>

          <button
            onClick={onSample}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-secondary disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            No PDFs handy? Run the sample analysis
          </button>
        </motion.div>

        <AnimatePresence>
          {fatalError && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mx-auto mt-8 flex max-w-lg items-start gap-3 rounded-2xl border border-danger/40 bg-danger/[0.07] p-5"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <div>
                <p className="font-display text-sm font-semibold text-ink">
                  Analysis failed
                </p>
                <p className="mt-1 text-sm leading-relaxed text-mist">{fatalError}</p>
                <button
                  onClick={() => setFatalError(null)}
                  className="mt-3 text-xs font-medium text-danger underline-offset-4 hover:underline"
                >
                  Dismiss and try again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </main>
      }
    >
      <AnalyzePageInner />
    </Suspense>
  );
}
