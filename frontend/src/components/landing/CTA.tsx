"use client";

import { useRef } from "react";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/Button";
import { IconArrowRight, IconGithub } from "@/components/ui/Icons";

/**
 * Closing CTA with a scrubbed background: the glow expands and the copy fades in
 * as the section travels through the viewport.
 */
export function CTA() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      gsap.fromTo(
        "[data-cta-glow]",
        { opacity: 0.25, scale: 0.86 },
        {
          opacity: 0.9,
          scale: 1.12,
          ease: "none",
          scrollTrigger: { trigger: root, start: "top 88%", end: "bottom 40%", scrub: 0.7 },
        },
      );

      gsap.fromTo(
        "[data-cta-copy] > *",
        { opacity: 0, y: 34 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: "expo.out",
          stagger: 0.1,
          scrollTrigger: { trigger: root, start: "top 74%", toggleActions: "play none none reverse" },
        },
      );

      gsap.fromTo(
        "[data-cta-rule]",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left center",
          scrollTrigger: { trigger: root, start: "top 80%", end: "bottom 55%", scrub: 0.5 },
        },
      );
    },
    { scope: scopeRef, disabled: reducedMotion },
  );

  return (
    <section ref={scopeRef} className="relative overflow-hidden py-section">
      <div
        data-cta-glow
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[520px] -translate-y-1/2 bg-hero-glow opacity-40"
      />

      <div className="section-inner">
        <div className="relative overflow-hidden rounded-card border border-line bg-surface/70 p-9 backdrop-blur-sm sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid opacity-[0.28]" />

          <div data-cta-copy className="relative mx-auto max-w-3xl space-y-7 text-center">
            <p className="eyebrow">Start with one document pair</p>
            <h2 className="text-h2 text-balance sm:text-h1">
              Stop guessing what the parser saw.
            </h2>
            <p className="mx-auto max-w-2xl text-lead text-ink-muted">
              Upload a resume and a job description — get an overall score, five weighted
              dimensions, matched and missing skills, an ATS formatting audit and a prioritised
              list of fixes. No account, no upload to a third party.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/analyze" size="lg" iconRight={<IconArrowRight size={18} />}>
                Analyse a resume
              </Button>
              <Button
                href="https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER"
                size="lg"
                variant="outline"
                iconLeft={<IconGithub size={18} />}
              >
                View the source
              </Button>
            </div>

            <div
              data-cta-rule
              className="mx-auto h-px w-full max-w-xl origin-left bg-gradient-to-r from-transparent via-line-strong to-transparent"
            />

            <p className="font-mono text-micro uppercase tracking-[0.18em] text-ink-faint">
              PDF · TXT · DOCX — up to 10 MB each — 10 analyses per minute
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
