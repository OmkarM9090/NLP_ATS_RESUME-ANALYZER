"use client";

import { useRef } from "react";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HOW_IT_WORKS } from "@/lib/constants";

/**
 * How it works: a horizontally pinned track on desktop.
 *
 * Vertical scroll is translated into horizontal travel for the duration of the
 * section, with a progress rail underneath. On mobile the track becomes a normal
 * vertical stack — horizontal pinning on a touch device fights the page scroll.
 */
export function HowItWorks() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(1024);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      const root = scopeRef.current;
      const track = trackRef.current;
      if (!root || !track) return;

      // Progress bar fills regardless of layout so the section always reads
      // as a sequence.
      gsap.fromTo(
        "[data-progress-fill]",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left center",
          scrollTrigger: { trigger: root, start: "top 75%", end: "bottom 55%", scrub: 0.5 },
        },
      );

      if (isMobile || reducedMotion) {
        gsap.fromTo(
          "[data-step]",
          { opacity: 0, y: 34 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "expo.out",
            stagger: 0.09,
            scrollTrigger: { trigger: root, start: "top 78%", toggleActions: "play none none reverse" },
          },
        );
        return;
      }

      // Horizontal pinned travel.
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 96);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: () => `+=${distance() + window.innerHeight * 0.6}`,
          pin: true,
          scrub: 0.85,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      gsap.fromTo(
        "[data-step]",
        { opacity: 0.35, y: 18 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: { trigger: root, start: "top top", end: () => `+=${distance()}`, scrub: 0.6 },
        },
      );

      return () => {
        tween.kill();
      };
    },
    { scope: scopeRef, deps: [isMobile, reducedMotion] },
  );

  return (
    <section
      id="how-it-works"
      ref={scopeRef}
      className="relative overflow-hidden"
      aria-labelledby="how-it-works-heading"
    >
      <div className="section-inner pt-section pb-10">
        <SectionHeading
          eyebrow="Workflow"
          title={<span id="how-it-works-heading">Four steps from upload to a prioritised fix list</span>}
          description="One request runs the whole pipeline. The stages below are the same ones the API reports in nlp_metadata.pipeline_stages_completed."
          align="left"
        />

        <div className="mt-8 h-px w-full bg-line">
          <div
            data-progress-fill
            className="h-px w-full origin-left bg-gradient-to-r from-primary-500 to-secondary-400"
          />
        </div>
      </div>

      {/* Horizontal track (desktop) / vertical stack (mobile) */}
      <div className={isMobile ? "section-inner pb-section" : "relative pb-section"}>
        <div
          ref={trackRef}
          className={
            isMobile
              ? "grid gap-5"
              : "flex w-max gap-6 px-6 will-change-transform lg:px-[max(24px,calc((100vw-1280px)/2))]"
          }
        >
          {HOW_IT_WORKS.map((step, index) => (
            <article
              key={step.step}
              data-step
              className={
                isMobile
                  ? "card p-6"
                  : "card flex w-[min(78vw,420px)] shrink-0 flex-col justify-between p-8 lg:w-[420px]"
              }
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="numeric text-h2 text-primary-300/90">{step.step}</span>
                  <span className="h-10 w-10 rounded-pill border border-line bg-surface-raised" aria-hidden>
                    <span className="block h-full w-full rounded-pill bg-gradient-to-br from-primary-500/25 to-transparent" />
                  </span>
                </div>
                <h3 className="text-h4">{step.title}</h3>
                <p className="text-body leading-relaxed text-ink-muted">{step.body}</p>
              </div>

              <div className="mt-8 flex items-center gap-3 border-t border-line pt-5">
                <span className="font-mono text-micro uppercase tracking-[0.16em] text-secondary-300">
                  {step.detail}
                </span>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <span className="ml-auto font-mono text-micro text-ink-faint">
                    {isMobile ? "" : "scroll →"}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
