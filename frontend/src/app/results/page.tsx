"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import type { AnalysisResponse } from "@/types/analysis";
import { getAnalysis } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { loadStoredResult, useAnalysisStore } from "@/stores/analysisStore";
import ScoreGauge from "@/components/results/ScoreGauge";
import ScoreBreakdown from "@/components/results/ScoreBreakdown";
import SkillsPanel from "@/components/results/SkillsPanel";
import KeywordsPanel from "@/components/results/KeywordsPanel";
import { ATSChecklist, SectionAccordion } from "@/components/results/DetailsPanel";
import { EntitiesPanel, MetadataStrip } from "@/components/results/EntitiesPanel";
import { GapsPanel, RecommendationsPanel } from "@/components/results/InsightsPanel";
import ResultsActions from "@/components/results/ResultsActions";

const NAV = [
  { id: "skills", label: "Skills" },
  { id: "keywords", label: "Keywords" },
  { id: "sections", label: "Sections & ATS" },
  { id: "insights", label: "Gaps & Fixes" },
  { id: "entities", label: "Entities" },
];

function SectionShell({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-secondary">
          {kicker}
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ResultsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storeResult = useAnalysisStore.getState().result;
      if (storeResult && (!id || storeResult.id === id)) {
        if (!cancelled) {
          setResult(storeResult);
          setStatus("ready");
        }
        return;
      }
      const stored = loadStoredResult();
      if (stored && (!id || stored.id === id)) {
        if (!cancelled) {
          setResult(stored);
          setStatus("ready");
        }
        return;
      }
      if (id) {
        try {
          const fetched = await getAnalysis(id);
          if (!cancelled) {
            if (!storeResult) useAnalysisStore.getState().setResult(fetched);
            setResult(fetched);
            setStatus("ready");
          }
          return;
        } catch (err) {
          if (!cancelled) {
            setErrorMsg(err instanceof Error ? err.message : "Not found");
            setStatus("error");
          }
          return;
        }
      }
      if (!cancelled) setStatus("empty");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-mono text-xs text-mist">loading analysis…</p>
      </main>
    );
  }

  if (status === "empty" || status === "error" || !result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="glass rounded-3xl p-10">
          <FileText className="mx-auto h-10 w-10 text-mist" />
          <h1 className="mt-5 font-display text-2xl font-semibold">
            {status === "error" ? "Couldn't load that analysis" : "No analysis to show yet"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-mist">
            {status === "error"
              ? errorMsg
              : "Upload a resume and a job description to generate your match report."}
          </p>
          <button onClick={() => router.push("/analyze")} className="mt-6">
            <span className="gradient-1 inline-flex h-12 items-center gap-2 rounded-xl px-7 font-display text-sm font-semibold text-white">
              Go to analysis <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen px-5 pb-24 pt-28 sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(99,102,241,0.13),transparent)]" />

      <div className="relative mx-auto max-w-6xl">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-secondary">
              Analysis report
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Resume <span className="text-mist">×</span> Job Match
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-mist">
              <span className="rounded-md bg-white/[0.04] px-2 py-1">{result.resume_filename}</span>
              <span className="text-mist/50">↔</span>
              <span className="rounded-md bg-white/[0.04] px-2 py-1">{result.jd_filename}</span>
            </div>
          </div>
          <div className="text-right font-mono text-[11px] leading-relaxed text-mist/70">
            <p>{formatDate(result.timestamp)}</p>
            <p>id {result.id.slice(0, 13)}…</p>
          </div>
        </motion.div>

        {/* overview */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-10 grid items-center gap-6 lg:grid-cols-[minmax(0,360px)_1fr]"
        >
          <div className="glass flex justify-center rounded-2xl p-8">
            <ScoreGauge score={result.overall_score} />
          </div>
          <ScoreBreakdown
            breakdown={result.score_breakdown}
            keywordDensity={result.keyword_analysis.keyword_density}
          />
        </motion.div>

        {/* section nav */}
        <nav className="sticky top-[4.5rem] z-30 mt-14 flex gap-1.5 overflow-x-auto rounded-full glass-strong p-1.5">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium text-mist transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              {n.label}
            </a>
          ))}
          <Link
            href="/analyze"
            className="ml-auto hidden whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium text-secondary transition-colors hover:bg-white/[0.06] sm:block"
          >
            New analysis →
          </Link>
        </nav>

        <div className="mt-12 space-y-16">
          <SectionShell id="skills" kicker="01 · taxonomy matching" title="Skill coverage">
            <SkillsPanel skills={result.skills_analysis} />
          </SectionShell>

          <SectionShell id="keywords" kicker="02 · tf-idf + rake" title="Keyword landscape">
            <KeywordsPanel keywords={result.keyword_analysis.top_jd_keywords} />
          </SectionShell>

          <SectionShell id="sections" kicker="03 · structure" title="Sections & ATS readiness">
            <div className="grid gap-5 lg:grid-cols-2">
              <SectionAccordion sections={result.section_scores} />
              <ATSChecklist ats={result.ats_formatting} />
            </div>
          </SectionShell>

          <SectionShell id="insights" kicker="04 · actionable" title="Gaps & how to fix them">
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <GapsPanel gaps={result.gap_analysis} />
              <RecommendationsPanel recs={result.recommendations} />
            </div>
          </SectionShell>

          <SectionShell id="entities" kicker="05 · ner" title="Detected entities">
            <EntitiesPanel entities={result.entity_extraction} />
          </SectionShell>

          <MetadataStrip meta={result.nlp_metadata} />

          <div className="border-t border-line/60 pt-10">
            <ResultsActions result={result} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      }
    >
      <ResultsInner />
    </Suspense>
  );
}
