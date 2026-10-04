"use client";

import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Crosshair,
  LayoutGrid,
  ListChecks,
  ScanText,
  Waypoints,
} from "lucide-react";
import { gsap, attachSpotlight, attachTilt, revealOnScroll } from "@/lib/anim";
import { SectionHeading } from "@/components/ui/primitives";

/* ------------------------------------------------------------------ visuals */

function PipelineVisual() {
  const stages = ["raw text", "tokens", "lemmas", "entities", "keywords"];
  const pairs = [
    ["shipped", "ship"],
    ["scaled", "scale"],
    ["built", "build"],
  ];
  return (
    <div className="mt-6 rounded-xl border border-line-soft bg-void/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {stages.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span
              data-stage-chip
              className={
                "rounded-lg border px-2.5 py-1 font-mono text-[10.5px] tracking-tight " +
                (i === stages.length - 1
                  ? "border-primary/40 bg-primary/15 text-primary-2"
                  : "border-line-soft bg-tint-1 text-mist")
              }
            >
              {s}
            </span>
            {i < stages.length - 1 && (
              <svg width="16" height="6" viewBox="0 0 16 6" className="shrink-0">
                <line
                  x1="0"
                  y1="3"
                  x2="16"
                  y2="3"
                  stroke="rgba(139,124,255,0.5)"
                  strokeWidth="1.4"
                  strokeDasharray="3 3"
                  className="animate-dash-flow"
                />
              </svg>
            )}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line-soft pt-3.5">
        {pairs.map(([from, to]) => (
          <span key={from} className="font-mono text-[10.5px] text-faint">
            <span className="text-mist/60 line-through decoration-line-strong">{from}</span>
            <span className="mx-1.5 text-primary-2">→</span>
            <span className="text-secondary">{to}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SemanticVisual() {
  const bars = [
    { label: "keyword overlap", value: 78, tone: "from-primary-2 to-primary" },
    { label: "semantic coverage", value: 91, tone: "from-secondary/80 to-secondary" },
  ];
  return (
    <div className="mt-6 rounded-xl border border-line-soft bg-void/40 p-4">
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                {b.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-mist">{b.value}</span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-tint-3">
              <span
                data-sem-bar
                className={`block h-full origin-left rounded-full bg-gradient-to-r ${b.tone}`}
                style={{ width: `${b.value}%`, transform: "scaleX(0)" }}
              />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line-soft pt-3.5">
        {["k8s ↔ Kubernetes", "react.js ↔ React", "golang ↔ Go"].map((p) => (
          <span
            key={p}
            data-synonym
            className="rounded-md border border-line-soft bg-tint-2 px-2 py-0.5 font-mono text-[10px] text-mist"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- cards */

const CARDS = [
  {
    icon: Waypoints,
    tag: "taxonomy",
    title: "Skill matching that survives aliases",
    body:
      "Roughly 700 canonical skills with alias resolution. Exact hits, fuzzy near-misses and embedding matches are reported separately, so you know what to rename — not just what to add.",
  },
  {
    icon: LayoutGrid,
    tag: "structure",
    title: "Section-level fit",
    body:
      "Twelve canonical resume sections are detected and scored against the posting, so a strong summary can't hide a thin experience section.",
  },
  {
    icon: ScanText,
    tag: "audit",
    title: "ATS formatting audit",
    body:
      "Thirteen parsing checks — contact block, tables, columns, fonts in the PDF text layer, date formats — each with a plain-language explanation.",
  },
] as const;

export default function FeaturesSection() {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const cleanups: Array<() => void> = [];
    el.querySelectorAll<HTMLElement>("[data-feature-card]").forEach((card) => {
      cleanups.push(attachSpotlight(card));
    });
    el.querySelectorAll<HTMLElement>(".bento-primary, .bento-semantic").forEach((card) => {
      cleanups.push(attachTilt(card, 4.5));
    });

    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-feature-card]"), {
        trigger: el,
        y: 46,
        stagger: 0.09,
        start: "top 78%",
      });
      revealOnScroll(el.querySelectorAll("[data-stage-chip]"), {
        trigger: el.querySelector(".bento-primary"),
        y: 12,
        stagger: 0.06,
        start: "top 80%",
      });
      revealOnScroll(el.querySelectorAll("[data-synonym]"), {
        trigger: el.querySelector(".bento-semantic"),
        y: 10,
        stagger: 0.08,
        start: "top 80%",
      });

      const semBars = el.querySelectorAll("[data-sem-bar]");
      gsap.to(semBars, {
        scaleX: 1,
        duration: 1.2,
        stagger: 0.14,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el.querySelector(".bento-semantic"),
          start: "top 80%",
          once: true,
        },
      });

      const rows = el.querySelectorAll("[data-fix-row]");
      revealOnScroll(rows, {
        trigger: el.querySelector(".bento-fixes"),
        y: 18,
        stagger: 0.08,
        start: "top 84%",
      });
    }, el);

    return () => {
      cleanups.forEach((c) => c());
      ctx.revert();
    };
  }, []);

  return (
    <section ref={scope} id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            align="left"
            kicker="why the number is trustworthy"
            title={
              <>
                Every score traces back to{" "}
                <span className="text-gradient">linguistic evidence.</span>
              </>
            }
            description="No black box. Each stage is inspectable: you can see the tokens, the lemmas, the entities and the exact keyword weights that produced your match score."
            className="max-w-2xl"
          />
          <a
            href="#how-it-works"
            className="group inline-flex items-center gap-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.2em] text-mist transition-colors hover:text-ink"
          >
            see it end to end
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          {/* ---------------------------- primary card ---------------------- */}
          <article
            data-feature-card
            className="bento-primary card spotlight group relative overflow-hidden p-6 sm:p-7 lg:col-span-3"
          >
            <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-primary-2/25 to-primary/10 ring-1 ring-primary/25 transition-transform duration-500 group-hover:-translate-y-0.5">
              <Brain className="h-5 w-5 text-primary-2" strokeWidth={1.9} />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
              nlp core
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
              A real pipeline, not a keyword counter
            </h3>
            <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-mist">
              Raw PDF text is normalised, tokenised with protected technical
              terms (<span className="font-mono text-[13px] text-mist/90">C++</span>,{" "}
              <span className="font-mono text-[13px] text-mist/90">Node.js</span>,{" "}
              <span className="font-mono text-[13px] text-mist/90">CI/CD</span>),
              lemmatised, POS-tagged and scanned for gazetteer entities — then
              ranked with TF-IDF, RAKE and TextRank.
            </p>
            <PipelineVisual />
          </article>

          {/* ---------------------------- semantic card --------------------- */}
          <article
            data-feature-card
            className="bento-semantic card spotlight group relative overflow-hidden p-6 sm:p-7 lg:col-span-3"
          >
            <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-secondary/25 to-secondary/10 ring-1 ring-secondary/25 transition-transform duration-500 group-hover:-translate-y-0.5">
              <Crosshair className="h-5 w-5 text-secondary" strokeWidth={1.9} />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
              semantics
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
              Meaning, not just vocabulary
            </h3>
            <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-mist">
              A sentence-level encoder measures how much of the posting your
              resume actually covers — so &ldquo;scaling distributed
              systems&rdquo; can match an architecture bullet without a single
              shared keyword.
            </p>
            <SemanticVisual />
          </article>

          {/* ---------------------------- small cards ----------------------- */}
          {CARDS.map(({ icon: Icon, tag, title, body }) => (
            <article
              key={title}
              data-feature-card
              className="card spotlight group relative overflow-hidden p-6 lg:col-span-2"
            >
              <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-tint-2 ring-1 ring-line-soft transition-transform duration-500 group-hover:-translate-y-0.5">
                <Icon className="h-4 w-4 text-ink/80" strokeWidth={1.9} />
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                {tag}
              </p>
              <h3 className="mt-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
                {title}
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-mist">{body}</p>
            </article>
          ))}

          {/* --------------------------- fixes card ------------------------- */}
          <article
            data-feature-card
            className="bento-fixes card spotlight group relative overflow-hidden p-6 sm:p-7 lg:col-span-6"
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
              <div className="lg:max-w-md">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-accent/20 to-accent/[0.06] ring-1 ring-accent/25">
                  <ListChecks className="h-5 w-5 text-accent" strokeWidth={1.9} />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                  action
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
                  Fixes ranked by how much they move the score
                </h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-mist">
                  Recommendations are deduplicated, capped at fourteen, and sorted
                  by priority and measured impact — each one names the exact term,
                  the section it belongs in, and why the parser cares.
                </p>
              </div>

              <div className="flex-1 space-y-2.5">
                {[
                  { p: "high", text: "Add “Kubernetes” to your skills block", impact: "+4.1" },
                  { p: "high", text: "Quantify the Platform Migration bullet", impact: "+3.2" },
                  { p: "medium", text: "Rename “React.js” to match the posting term", impact: "+1.8" },
                ].map((row) => (
                  <div
                    key={row.text}
                    data-fix-row
                    className="flex items-center gap-3 rounded-xl border border-line-soft bg-void/40 px-4 py-3"
                  >
                    <span
                      className={
                        "rounded-md px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] " +
                        (row.p === "high"
                          ? "bg-danger/12 text-danger ring-1 ring-danger/25"
                          : "bg-warning/12 text-warning ring-1 ring-warning/25")
                      }
                    >
                      {row.p}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink/90">
                      {row.text}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-success">
                      {row.impact}
                    </span>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-faint" />
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
