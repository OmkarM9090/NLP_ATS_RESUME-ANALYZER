"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { gsap } from "@/lib/gsap-config";
import { attachTilt } from "@/lib/anim";
import { SectionHeading } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Everything you need for a focused job search.",
    features: [
      "Unlimited resume analyses",
      "Full NLP pipeline (14 stages)",
      "Skill gaps & keyword coverage",
      "ATS formatting audit",
      "Session history",
    ],
    cta: "Start free",
    href: "/analyze",
    featured: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    blurb: "For people applying deliberately, at volume.",
    features: [
      "Everything in Free",
      "Unlimited stored history",
      "JSON + summary export",
      "Priority pipeline queue",
      "Keyword density tuning notes",
      "Side-by-side version compare",
    ],
    cta: "Go Pro",
    href: "/analyze",
    featured: true,
  },
  {
    name: "Teams",
    price: "Custom",
    period: "",
    blurb: "Career centres, bootcamps and hiring teams.",
    features: [
      "Everything in Pro",
      "Team dashboards",
      "Custom skill taxonomy",
      "REST API access",
      "SSO & audit log",
    ],
    cta: "Talk to us",
    href: "/analyze",
    featured: false,
  },
];

export default function PricingSection() {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const cleanups: Array<() => void> = [];
    el.querySelectorAll<HTMLElement>("[data-tier]").forEach((tier) => {
      cleanups.push(attachTilt(tier, 5));
    });

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll("[data-tier]"),
        { y: 52, opacity: 0, rotateX: -10, transformPerspective: 1000 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 1,
          stagger: 0.11,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 74%", once: true },
        },
      );
    }, el);
    return () => {
      cleanups.forEach((c) => c());
      ctx.revert();
    };
  }, []);

  return (
    <section ref={scope} id="pricing" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[340px] w-[820px] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[170px]" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="pricing"
          title={
            <>
              Start free.{" "}
              <span className="text-gradient">Upgrade only if it pays for itself.</span>
            </>
          }
          description="No account required for your first analysis, and no paywall between you and your score."
        />

        <div className="mt-16 grid items-stretch gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              data-tier
              className={cn(
                "card relative flex flex-col p-6 sm:p-7",
                tier.featured
                  ? "ring-gradient bg-[linear-gradient(180deg,rgba(110,86,248,0.14),rgba(14,16,22,0.7))] shadow-[0_50px_110px_-50px_rgba(110,86,248,0.9)] md:-my-3 md:py-9"
                  : "card-hover",
              )}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary-2 to-primary px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_-12px_rgba(110,86,248,1)]">
                  <Sparkles className="h-3 w-3" strokeWidth={2.4} />
                  most popular
                </span>
              )}

              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-[15px] font-semibold uppercase tracking-[0.16em] text-ink/90">
                  {tier.name}
                </h3>
              </div>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-[38px] font-bold leading-none tracking-[-0.04em]">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="font-mono text-[11px] text-faint">{tier.period}</span>
                )}
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mist">{tier.blurb}</p>

              <div className="my-6 h-px bg-gradient-to-r from-white/[0.1] to-transparent" />

              <ul className="flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        tier.featured ? "bg-primary/25" : "bg-white/[0.07]",
                      )}
                    >
                      <Check
                        className={cn(
                          "h-2.5 w-2.5",
                          tier.featured ? "text-primary-2" : "text-mist",
                        )}
                        strokeWidth={3}
                      />
                    </span>
                    <span className="text-[13.5px] leading-snug text-ink/85">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.href}
                className={cn(
                  "btn group mt-8 w-full",
                  tier.featured ? "btn-primary" : "btn-secondary",
                )}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          this build runs the free tier · paid plans are illustrative
        </p>
      </div>
    </section>
  );
}
