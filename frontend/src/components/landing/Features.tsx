"use client";

import { useRef } from "react";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FEATURE_ICONS, type FeatureIconName } from "@/components/ui/Icons";
import { FEATURES } from "@/lib/constants";

/**
 * Features: the heading is pinned while the card grid scrolls past, and each
 * card is magnetic (drifts toward the cursor) on pointer devices.
 *
 * On mobile the pin is dropped — a pinned column at 375px wastes half the
 * viewport — and the cards simply fade up in sequence.
 */
export function Features() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(1024);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      const root = scopeRef.current;
      if (!root) return;

      const cards = gsap.utils.toArray<HTMLElement>("[data-feature-card]", root);

      if (!isMobile && !reducedMotion) {
        // Pinned title column: the copy stays while the grid travels.
        gsap.to("[data-feature-copy]", {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top 70%",
            end: "bottom 60%",
            scrub: 0.7,
          },
        });
      }

      // Card reveal — staggered column-wise on desktop, sequential on mobile.
      gsap.fromTo(
        cards,
        { opacity: 0, y: 42, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: isMobile ? 0.6 : 0.85,
          ease: "expo.out",
          stagger: isMobile ? 0.08 : { each: 0.09, grid: [2, 3], from: "start" },
          scrollTrigger: {
            trigger: root,
            start: "top 74%",
            toggleActions: "play none none reverse",
          },
        },
      );

      gsap.fromTo(
        "[data-feature-heading]",
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
    <section id="features" className="section" aria-labelledby="features-heading">
      <div className="section-inner">
        <div ref={scopeRef} className="grid gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
          <div data-feature-copy className="lg:sticky lg:top-28 lg:self-start">
            <div data-feature-heading>
              <SectionHeading
                eyebrow="Capabilities"
                title={<span id="features-heading">Everything the parser sees, you see too</span>}
                description="The same pipeline runs for every analysis. Nothing is approximated client-side, and every number on the results page traces back to a stage below."
              />
            </div>

            <dl className="mt-9 space-y-4 border-t border-line pt-7">
              {[
                { term: "Weighting", detail: "Keywords 25 · Semantics 30 · Skills 25 · Experience 10 · Education 10" },
                { term: "Encoders", detail: "all-MiniLM-L6-v2 with a TF-IDF/LSA fallback" },
                { term: "Taxonomy", detail: "157 canonical skills, 774 aliases resolved" },
              ].map((row) => (
                <div key={row.term} className="space-y-1">
                  <dt className="label">{row.term}</dt>
                  <dd className="text-small text-ink-muted">{row.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon as FeatureIconName];
              return (
                <Card
                  key={feature.title}
                  data-feature-card
                  interactive
                  sheen
                  accent="primary"
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-button border border-primary-500/30 bg-primary-500/12 text-primary-200 transition-transform duration-300 group-hover/card:-translate-y-0.5">
                      <Icon size={20} />
                    </span>
                    <span className="font-mono text-micro text-ink-faint">
                      {String(FEATURES.indexOf(feature) + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-h5">{feature.title}</h3>
                    <p className="text-small leading-relaxed text-ink-muted">{feature.body}</p>
                  </div>

                  <ul className="mt-auto space-y-1.5 border-t border-line pt-4">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-small text-ink-faint">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary-400" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
