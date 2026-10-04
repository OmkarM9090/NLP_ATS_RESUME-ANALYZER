"use client";

import { useRef } from "react";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { IconCheck } from "@/components/ui/Icons";
import { PRICING_TIERS } from "@/lib/constants";
import { cn } from "@/lib/cn";

/** Pricing: three tiers, staggered in on scroll, middle tier highlighted. */
export function Pricing() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGsapContext(
    () => {
      gsap.fromTo(
        "[data-tier]",
        { opacity: 0, y: 44, rotateX: -4 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.85,
          ease: "expo.out",
          stagger: 0.11,
          scrollTrigger: { trigger: scopeRef.current, start: "top 78%", toggleActions: "play none none reverse" },
        },
      );
    },
    { scope: scopeRef, disabled: reducedMotion },
  );

  return (
    <section id="pricing" className="section" aria-labelledby="pricing-heading">
      <div className="section-inner">
        <SectionHeading
          eyebrow="Pricing"
          title={<span id="pricing-heading">Free to run, yours to host</span>}
          description="The whole stack is MIT-licensed. There is no paid tier for the analysis itself — the options below are about where you run it."
          align="center"
          className="max-w-2xl"
        />

        <div ref={scopeRef} className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              data-tier
              className={cn(
                "relative flex h-full flex-col rounded-card border p-7 transition-colors duration-300",
                tier.highlighted
                  ? "border-primary-400/50 bg-surface-raised shadow-glow lg:-mt-4 lg:mb-4"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              {tier.highlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="primary">Recommended</Badge>
                </span>
              ) : null}

              <div className="space-y-2">
                <h3 className="text-h4">{tier.name}</h3>
                <p className="text-small text-ink-muted">{tier.tagline}</p>
              </div>

              <div className="mt-6 flex items-end gap-2 border-y border-line py-6">
                <span className="numeric text-[44px] leading-none font-semibold text-ink">
                  {tier.price}
                </span>
                <span className="pb-1 text-small text-ink-faint">{tier.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-small text-ink-muted">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0",
                        tier.highlighted ? "text-primary-300" : "text-success",
                      )}
                    >
                      <IconCheck size={16} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                href={tier.href}
                variant={tier.highlighted ? "primary" : "outline"}
                size="md"
                fullWidth
                className="mt-8"
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
