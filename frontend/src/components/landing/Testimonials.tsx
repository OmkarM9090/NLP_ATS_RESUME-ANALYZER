"use client";

import { useRef } from "react";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { TESTIMONIALS } from "@/lib/constants";

/**
 * Testimonials: cards stack on top of each other as you scroll.
 *
 * Each card pins slightly below the previous one with a small scale/opacity
 * falloff, producing the classic "stacked deck" effect. On mobile the stack is
 * reduced to a simple staggered column to keep the scroll height sane.
 */
export function Testimonials() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(768);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      const cards = gsap.utils.toArray<HTMLElement>("[data-testimonial]", root);

      if (isMobile || reducedMotion) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            ease: "expo.out",
            stagger: 0.08,
            scrollTrigger: { trigger: root, start: "top 80%", toggleActions: "play none none reverse" },
          },
        );
        return;
      }

      cards.forEach((card, index) => {
        if (index === 0) return;
        gsap.fromTo(
          card,
          { yPercent: 12 + index * 4, opacity: 0.4, scale: 0.965 },
          {
            yPercent: 0,
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top bottom-=12%",
              end: "top 34%",
              scrub: 0.7,
            },
          },
        );
      });

      gsap.fromTo(
        "[data-testimonial-heading]",
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "expo.out",
          scrollTrigger: { trigger: root, start: "top 82%", toggleActions: "play none none reverse" },
        },
      );
    },
    { scope: scopeRef, deps: [isMobile, reducedMotion] },
  );

  return (
    <section className="section" aria-labelledby="testimonials-heading">
      <div className="section-inner">
        <div data-testimonial-heading className="max-w-2xl">
          <SectionHeading
            eyebrow="Outcomes"
            title={<span id="testimonials-heading">What changes after one honest analysis</span>}
            description="Quotes from candidates, recruiters and platform teams who ran their documents through the pipeline."
          />
        </div>

        <div ref={scopeRef} className="mt-12 space-y-5">
          {TESTIMONIALS.map((entry, index) => (
            <figure
              key={entry.name}
              data-testimonial
              className="card-raised relative p-7 sm:p-9"
              style={{ zIndex: TESTIMONIALS.length - index }}
            >
              <span className="absolute right-7 top-6 font-heading text-[64px] leading-none text-primary-500/12 select-none">
                &rdquo;
              </span>

              <blockquote className="max-w-3xl text-lead text-ink/90 sm:text-[20px]">
                {entry.quote}
              </blockquote>

              <figcaption className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-6">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-pill border border-line bg-surface-raised font-heading text-h5 text-primary-200"
                  aria-hidden
                >
                  {entry.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-ink">{entry.name}</span>
                  <span className="block text-small text-ink-muted">{entry.role}</span>
                </span>
                <Badge tone="secondary" className="ml-auto">
                  {entry.metric}
                </Badge>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
