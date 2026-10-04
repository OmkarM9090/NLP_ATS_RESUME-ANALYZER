"use client";

import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconArrowRight, IconLayers, IconTarget } from "@/components/ui/Icons";

const HEADLINE = "Know exactly why an ATS rejected your resume.";
const SUBHEAD =
  "Upload a resume and a job description. A twelve-stage NLP pipeline extracts, lemmatizes, tags, vectorises and scores the match — then tells you which keywords, skills and sections to fix first.";

const HIGHLIGHTS = [
  { label: "5 weighted dimensions", icon: IconTarget },
  { label: "12 pipeline stages", icon: IconLayers },
  { label: "No account required", icon: IconArrowRight },
] as const;

/**
 * Hero: SplitText character reveal on the headline, staggered subhead/CTAs, and
 * a slow parallax on the glow layer.
 *
 * SplitText is bundled with gsap ≥3.13, so the effect is available offline. On
 * reduced-motion (or if splitting fails) the text simply renders normally.
 */
export function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      const timeline = gsap.timeline({ defaults: { ease: "expo.out" } });

      // Character reveal — falls back to a fade if SplitText cannot run.
      try {
        const split = SplitText.create(headlineRef.current, {
          type: "chars,words",
          wordsClass: "hero-word",
          charsClass: "hero-char",
          autoSplit: true,
        });
        timeline.fromTo(
          split.chars,
          { yPercent: 112, opacity: 0, rotateX: -42 },
          { yPercent: 0, opacity: 1, rotateX: 0, duration: 1.15, stagger: 0.018 },
          0.05,
        );
        // Revert only the split (not the whole context) after the reveal so the
        // DOM returns to plain text for selection and screen readers.
        timeline.add(() => split.revert(), ">0.6");
      } catch {
        timeline.fromTo(
          headlineRef.current,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.9 },
          0.05,
        );
      }

      timeline
        .fromTo(
          "[data-hero-fade]",
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 },
          0.42,
        )
        .fromTo(
          "[data-hero-glow]",
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 1.8, ease: "sine.out" },
          0,
        )
        .fromTo(
          "[data-hero-card]",
          { opacity: 0, y: 46, rotateX: -8 },
          { opacity: 1, y: 0, rotateX: 0, duration: 1.1 },
          0.7,
        );

      // Subtle scroll parallax on the headline + glow.
      gsap.to("[data-hero-glow]", {
        yPercent: 22,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.6 },
      });
      gsap.to(headlineRef.current, {
        yPercent: -8,
        opacity: 0.65,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.8 },
      });

      return () => {
        timeline.kill();
      };
    },
    { scope: scopeRef, disabled: reducedMotion },
  );

  return (
    <section
      ref={scopeRef}
      className="relative isolate overflow-hidden pt-[calc(72px+56px)] pb-20 sm:pt-[calc(72px+76px)] lg:pb-28"
      aria-labelledby="hero-heading"
    >
      {/* Ambient glow + grid */}
      <div
        data-hero-glow
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[620px] bg-hero-glow opacity-70"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint bg-grid opacity-[0.35] mask-fade-b" />

      <div className="section-inner">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div data-hero-fade className="mb-7 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="primary" className="gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-400" />
              </span>
              spaCy · sentence-transformers · FastAPI
            </Badge>
            <Badge tone="outline">Deterministic scoring</Badge>
          </div>

          <h1
            id="hero-heading"
            ref={headlineRef}
            className="split-parent text-h1 text-balance sm:text-[64px] lg:text-display"
          >
            {HEADLINE}
          </h1>

          <p
            data-hero-fade
            className="mt-7 max-w-2xl text-lead text-ink-muted sm:text-[19px]"
          >
            {SUBHEAD}
          </p>

          <div data-hero-fade className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button href="/analyze" size="lg" iconRight={<IconArrowRight size={18} />}>
              Analyse my resume
            </Button>
            <Button href="/#how-it-works" size="lg" variant="outline">
              See the pipeline
            </Button>
          </div>

          <ul data-hero-fade className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {HIGHLIGHTS.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-2 text-small text-ink-muted">
                <Icon size={16} className="text-secondary-300" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <HeroPreviewCard />
      </div>
    </section>
  );
}

/**
 * Static "result preview" card. Uses real numbers from a measured run so the
 * landing page never advertises output the API cannot produce.
 */
function HeroPreviewCard() {
  const rows = [
    { label: "Keyword match", value: 67.2, weight: "25%" },
    { label: "Semantic similarity", value: 81.6, weight: "30%" },
    { label: "Skill match", value: 81.0, weight: "25%" },
    { label: "Experience relevance", value: 87.9, weight: "10%" },
    { label: "Education match", value: 100.0, weight: "10%" },
  ];

  return (
    <div
      data-hero-card
      className="relative mx-auto mt-16 w-full max-w-4xl [perspective:1400px] lg:mt-20"
    >
      <div className="card-raised overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line bg-surface/70 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            </span>
            <span className="font-mono text-micro uppercase tracking-[0.18em] text-ink-faint">
              analysis · john_doe_resume.pdf
            </span>
          </div>
          <Badge tone="success">17 stages · 0.81 s</Badge>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-small text-ink-muted">{row.label}</span>
                  <span className="numeric text-small text-ink">
                    {row.value.toFixed(1)}
                    <span className="ml-2 text-micro text-ink-faint">{row.weight}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-raised">
                  <div
                    className="h-full rounded-pill bg-gradient-to-r from-primary-500 to-secondary-400"
                    style={{ width: `${row.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-surface/60 p-5 text-center">
            <p className="label">Overall match</p>
            <p className="numeric text-[64px] leading-none font-semibold text-success">80.3</p>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-success/40 bg-success/12 font-heading text-h5 text-success">
              B
            </span>
            <p className="text-small text-ink-muted">
              Strong match — 17 skills matched, 4 missing.
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -inset-x-10 -bottom-16 -z-10 h-40 bg-hero-glow opacity-40 blur-2xl" />
    </div>
  );
}
