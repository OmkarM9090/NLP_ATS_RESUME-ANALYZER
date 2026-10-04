"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import gsap from "gsap";

import { AnalysisLoader } from "@/components/analyze/AnalysisLoader";
import { ATSChecklist } from "@/components/results/ATSChecklist";
import { EntityPanel } from "@/components/results/EntityPanel";
import { ExportButtons } from "@/components/results/ExportButtons";
import { GapPanel } from "@/components/results/GapPanel";
import { KeywordCloud } from "@/components/results/KeywordCloud";
import { NLPMetadataPanel } from "@/components/results/NLPMetadataPanel";
import { PreviewPanel } from "@/components/results/PreviewPanel";
import { Recommendations } from "@/components/results/Recommendations";
import { ResultHeader } from "@/components/results/ResultHeader";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import { ScoreGauge } from "@/components/results/ScoreGauge";
import { SectionAccordion } from "@/components/results/SectionAccordion";
import { SkillsPanel } from "@/components/results/SkillsPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconArrowRight, IconUpload } from "@/components/ui/Icons";
import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { formatCount, formatScore } from "@/lib/format";
import { useAnalysisStore } from "@/stores/analysisStore";

/**
 * /results — renders whatever the analysis store holds.
 *
 * Three states: no result yet (empty prompt), a run in flight (the pipeline
 * loader), and the full report. Sections reveal on scroll via a shared GSAP
 * context that is reverted on unmount.
 */
export default function ResultsPage() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const scopeRef = useRef<HTMLDivElement>(null);

  const result = useAnalysisStore((state) => state.result);
  const status = useAnalysisStore((state) => state.status);
  const percent = useAnalysisStore((state) => state.percent);
  const stageIndex = useAnalysisStore((state) => state.stageIndex);
  const uploadPercent = useAnalysisStore((state) => state.uploadPercent);
  const startedAt = useAnalysisStore((state) => state.startedAt);
  const fromHistory = useAnalysisStore((state) => state.fromHistory);

  useGsapContext(
    () => {
      gsap.utils.toArray<HTMLElement>("[data-result-section]").forEach((element) => {
        gsap.fromTo(
          element,
          { opacity: 0, y: 34 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: "expo.out",
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });
    },
    { scope: scopeRef, disabled: reducedMotion, deps: [result?.id] },
  );

  // A direct visit to /results with nothing in the store goes back to /analyze.
  useEffect(() => {
    if (!result && status === "idle") {
      const timer = window.setTimeout(() => router.replace("/analyze"), 1200);
      return () => window.clearTimeout(timer);
    }
  }, [result, router, status]);

  if (!result) {
    return (
      <div className="pt-[calc(72px+48px)] pb-section">
        <div className="section-inner">
          {status === "analyzing" || status === "uploading" ? (
            <div className="mx-auto max-w-2xl">
              <AnalysisLoader
                percent={percent}
                stageIndex={stageIndex}
                uploadPercent={uploadPercent}
                startedAt={startedAt}
              />
            </div>
          ) : (
            <Card className="mx-auto max-w-xl space-y-5 py-14 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-pill border border-line bg-surface-raised text-ink-muted">
                <IconUpload size={24} />
              </span>
              <div className="space-y-2">
                <h1 className="text-h3">No analysis to show yet</h1>
                <p className="text-body text-ink-muted">
                  Upload a resume and a job description to generate a match report.
                </p>
              </div>
              <Button href="/analyze" size="lg" iconRight={<IconArrowRight size={18} />}>
                Go to the analyser
              </Button>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const skills = result.skills_analysis;
  const meta = result.nlp_metadata;

  return (
    <div ref={scopeRef} className="pt-[calc(72px+40px)] pb-section">
      <div className="section-inner space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <ResultHeader
            result={result}
            onNewAnalysis={() => router.push("/analyze")}
            onBack={() => router.back()}
          />
        </motion.div>

        {fromHistory ? (
          <p className="rounded-card border border-line bg-surface/50 px-4 py-3 text-small text-ink-muted">
            Loaded from history — this is the stored result of an earlier run.
          </p>
        ) : null}

        {/* Top row: gauge + summary stats + exports */}
        <div data-result-section className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="flex flex-col items-center justify-center gap-6 py-8">
            <ScoreGauge score={result.overall_score} grade={result.grade} />
            <div className="w-full space-y-3 border-t border-line pt-5">
              <SummaryRow
                label="Matched skills"
                value={formatCount(skills?.matched?.length ?? 0, "skill")}
                tone="text-success"
              />
              <SummaryRow
                label="Missing skills"
                value={formatCount(skills?.missing?.length ?? 0, "skill")}
                tone={skills?.missing?.length ? "text-danger" : "text-ink"}
              />
              <SummaryRow
                label="ATS formatting"
                value={`${formatScore(result.ats_formatting?.score ?? 0)} / 100`}
                tone="text-ink"
              />
              <SummaryRow
                label="Recommendations"
                value={formatCount(result.recommendations?.length ?? 0, "item")}
                tone="text-ink"
              />
              <SummaryRow
                label="Coverage ratio"
                value={`${Math.round((result.gap_analysis?.coverage_ratio ?? 0) * 100)}%`}
                tone="text-secondary-300"
              />
            </div>
            <ExportButtons result={result} className="no-print w-full border-t border-line pt-5" />
          </Card>

          <Card>
            <ScoreBreakdown breakdown={result.score_breakdown} overall={result.overall_score} />
          </Card>
        </div>

        {meta?.degraded_mode ? (
          <div data-result-section className="rounded-card border border-warning/35 bg-warning/8 px-5 py-4">
            <p className="text-small font-semibold text-warning">
              This run used fallback models — treat the score as indicative
            </p>
            <ul className="mt-2 space-y-1">
              {(meta.warnings ?? []).map((warning) => (
                <li key={warning} className="text-small leading-relaxed text-ink-muted">
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div data-result-section>
          <SkillsPanel details={result.skill_details} />
        </div>

        <div data-result-section>
          <KeywordCloud analysis={result.keyword_analysis} />
        </div>

        <div data-result-section>
          <GapPanel gap={result.gap_analysis} />
        </div>

        <div data-result-section>
          <Recommendations items={result.recommendations ?? []} />
        </div>

        <div data-result-section>
          <SectionAccordion sectionScores={result.section_scores} sections={result.sections} />
        </div>

        <div data-result-section>
          <ATSChecklist check={result.ats_formatting} />
        </div>

        <div data-result-section className="grid gap-6 xl:grid-cols-2">
          <EntityPanel entities={result.entity_extraction} />
          <NLPMetadataPanel metadata={meta} />
        </div>

        <div data-result-section>
          <PreviewPanel result={result} />
        </div>

        <div data-result-section className="no-print flex flex-col items-center gap-4 rounded-card border border-line bg-surface/50 px-6 py-10 text-center">
          <h2 className="text-h3">Run another comparison</h2>
          <p className="max-w-xl text-body text-ink-muted">
            Tailor the resume for a different posting, or re-run after editing to measure the
            improvement. Results stay in history as long as you keep them.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button href="/analyze" size="lg" iconRight={<IconArrowRight size={18} />}>
              New analysis
            </Button>
            <Button href="/" size="lg" variant="outline">
              Back to home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label">{label}</span>
      <span className={`numeric text-body ${tone}`}>{value}</span>
    </div>
  );
}
