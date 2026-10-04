"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import type { AnalysisResponse } from "@/types/analysis";
import { getAnalysis } from "@/lib/api";
import { formatDate, scoreColor } from "@/lib/utils";
import { loadStoredResult, useAnalysisStore } from "@/stores/analysisStore";
import ScoreGauge from "@/components/results/ScoreGauge";
import ScoreBreakdown from "@/components/results/ScoreBreakdown";
import SkillsPanel from "@/components/results/SkillsPanel";
import KeywordsPanel from "@/components/results/KeywordsPanel";
import { ATSChecklist, SectionAccordion } from "@/components/results/DetailsPanel";
import { EntitiesPanel, MetadataStrip } from "@/components/results/EntitiesPanel";
import { GapsPanel, RecommendationsPanel } from "@/components/results/InsightsPanel";
import ResultsActions from "@/components/results/ResultsActions";
import { gsap, ScrollTrigger, revealOnScroll } from "@/lib/anim";

const NAV = [
  { id: "skills", label: "Skills" },
  { id: "keywords", label: "Keywords" },
  { id: "sections", label: "Sections & ATS" },
  { id: "insights", label: "Gaps & fixes" },
  { id: "entities", label: "Entities" },
];

function SectionShell({
  id,
  step,
  title,
  trailing,
  children,
}: {
  id: string;
  step: string;
  title: string;
  trailing?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-secondary">
            {step}
          </p>
          <h2 className="mt-2 font-display text-[22px] font-semibold tracking-[-0.025em] sm:text-[26px]">
            {title}
          </h2>
        </div>
        {trailing && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
            {trailing}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ResultsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const rootRef = useRef<HTMLDivElement>(null);

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
  }, [id]);

  /* -------------------- entrance + scroll progress rail ---------------- */
  useEffect(() => {
    if (status !== "ready") return;
    const el = rootRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const blocks = el.querySelectorAll("[data-enter]");
      if (reduced) {
        gsap.set(blocks, { opacity: 1, clearProps: "transform" });
      } else {
        gsap.fromTo(
          blocks,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: "power3.out" },
        );
      }

      // scroll-spy for the sticky report nav
      const links = gsap.utils.toArray<HTMLAnchorElement>("[data-nav-link]", el);
      const pill = el.querySelector<HTMLElement>("[data-nav-pill]");

      const movePill = (link: HTMLAnchorElement) => {
        if (!pill || !link.parentElement) return;
        const wrap = link.parentElement.getBoundingClientRect();
        const r = link.getBoundingClientRect();
        gsap.to(pill, {
          autoAlpha: 1,
          x: r.left - wrap.left,
          width: r.width,
          duration: 0.4,
          ease: "power3.out",
        });
      };

      NAV.forEach((nav, i) => {
        const section = document.getElementById(nav.id);
        if (!section) return;
        ScrollTrigger.create({
          trigger: section,
          start: "top 45%",
          end: "bottom 45%",
          onToggle: (self) => {
            if (!self.isActive) return;
            links.forEach((l) => l.classList.remove("is-active"));
            links[i]?.classList.add("is-active");
            if (links[i]) movePill(links[i]);
          },
        });
      });

      revealOnScroll(el.querySelectorAll("[data-enter-scroll]"), {
        trigger: el,
        y: 26,
        stagger: 0.07,
        start: "top 88%",
      });
    }, el);

    return () => ctx.revert();
  }, [status]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-7 w-7 animate-spin text-primary-2" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          loading report…
        </p>
      </main>
    );
  }

  if (status === "empty" || status === "error" || !result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="card w-full max-w-md rounded-3xl p-10">
          <FileText className="mx-auto h-8 w-8 text-faint" />
          <h1 className="mt-5 font-display text-[22px] font-semibold tracking-[-0.02em]">
            {status === "error" ? "Couldn't load that analysis" : "No report yet"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-mist">
            {status === "error"
              ? errorMsg
              : "Upload a resume and a job description to generate a match report."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/analyze")}
            className="btn btn-primary group mt-7 w-full"
          >
            Go to analysis
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </main>
    );
  }

  const accent = scoreColor(result.overall_score);

  return (
    <main ref={rootRef} className="relative min-h-screen px-5 pb-24 pt-28 sm:px-8 lg:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(110,86,248,0.13),transparent)]" />

      <div className="relative mx-auto max-w-6xl">
        {/* ------------------------------- header ------------------------- */}
        <div data-enter className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="eyebrow">
              <span className="h-1 w-1 rounded-full bg-secondary" />
              analysis report
            </p>
            <h1 className="display-3 mt-4">Resume × Job match</h1>

            {result.verdict && (
              <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-mist">
                {result.verdict}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip">
                <FileText className="h-3 w-3 text-primary-2" strokeWidth={2.3} />
                {result.resume_filename}
              </span>
              <span className="font-mono text-[11px] text-faint">×</span>
              <span className="chip">
                <FileText className="h-3 w-3 text-secondary" strokeWidth={2.3} />
                {result.jd_filename}
              </span>
            </div>
          </div>

          <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
            <p>{formatDate(result.timestamp)}</p>
            <p className="mt-1">id {result.id.slice(0, 12)}</p>
            <p className="mt-1" style={{ color: accent }}>
              {result.nlp_metadata.degraded_mode ? "degraded mode" : "full pipeline"}
            </p>
          </div>
        </div>

        {/* ------------------------------ overview ----------------------- */}
        <div
          data-enter
          className="mt-10 grid items-stretch gap-5 lg:grid-cols-[minmax(0,340px)_1fr]"
        >
          <div className="card flex items-center justify-center rounded-2xl p-6 sm:p-8">
            <ScoreGauge score={result.overall_score} />
          </div>
          <ScoreBreakdown
            breakdown={result.score_breakdown}
            keywordDensity={result.keyword_analysis.keyword_density}
          />
        </div>

        {/* -------------------------- sticky section nav ---------------- */}
        <nav
          data-enter
          className="sticky top-[4.75rem] z-30 mt-12 flex items-center gap-1 rounded-full p-1.5 nav-shell"
          aria-label="Report sections"
        >
          <div className="relative flex flex-1 items-center gap-0.5 overflow-x-auto hide-scrollbar">
            <span
              data-nav-pill
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-white/[0.08] opacity-0 ring-1 ring-white/[0.06]"
              style={{ width: 0 }}
            />
            {NAV.map((n) => (
              <a
                key={n.id}
                data-nav-link
                href={`#${n.id}`}
                className="relative z-10 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-medium text-mist transition-colors duration-300 hover:text-ink [&.is-active]:text-ink"
              >
                {n.label}
              </a>
            ))}
          </div>
          <Link
            href="/analyze"
            className="hidden whitespace-nowrap rounded-full px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-secondary transition-colors hover:bg-white/[0.06] sm:block"
          >
            new analysis
          </Link>
        </nav>

        <div className="mt-14 space-y-20">
          <div data-enter-scroll>
            <SectionShell
              id="skills"
              step="01 · taxonomy matching"
              title="Skill coverage"
              trailing={`${result.skills_analysis.matched.length} of ${result.skills_analysis.matched.length + result.skills_analysis.missing.length} required`}
            >
              <SkillsPanel skills={result.skills_analysis} />
            </SectionShell>
          </div>

          <div data-enter-scroll>
            <SectionShell
              id="keywords"
              step="02 · tf-idf + rake"
              title="Keyword landscape"
              trailing={`${result.keyword_analysis.top_jd_keywords.length} ranked terms`}
            >
              <KeywordsPanel keywords={result.keyword_analysis.top_jd_keywords} />
            </SectionShell>
          </div>

          <div data-enter-scroll>
            <SectionShell id="sections" step="03 · structure" title="Sections & ATS readiness">
              <div className="grid gap-5 lg:grid-cols-2">
                <SectionAccordion sections={result.section_scores} />
                <ATSChecklist ats={result.ats_formatting} />
              </div>
            </SectionShell>
          </div>

          <div data-enter-scroll>
            <SectionShell
              id="insights"
              step="04 · actionable"
              title="Gaps & how to fix them"
              trailing={`${result.recommendations.length} prioritised fixes`}
            >
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <GapsPanel gaps={result.gap_analysis} />
                <RecommendationsPanel recs={result.recommendations} />
              </div>
            </SectionShell>
          </div>

          <div data-enter-scroll>
            <SectionShell id="entities" step="05 · named entities" title="Detected entities">
              <EntitiesPanel entities={result.entity_extraction} />
            </SectionShell>
          </div>

          <div data-enter-scroll>
            <MetadataStrip meta={result.nlp_metadata} />
          </div>

          <div data-enter-scroll className="border-t border-white/[0.06] pt-10">
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
          <Loader2 className="h-7 w-7 animate-spin text-primary-2" />
        </main>
      }
    >
      <ResultsInner />
    </Suspense>
  );
}
