"use client";

import { Check, Crown } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";
import { SectionHeading, LinkButton } from "@/components/ui/primitives";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Everything you need for a focused job hunt.",
    features: [
      "Unlimited resume analyses",
      "Full 12-stage NLP pipeline",
      "Skill gap & keyword analysis",
      "ATS formatting check",
    ],
    cta: "Start free",
    href: "/analyze",
    featured: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    blurb: "For power applicants running many applications.",
    features: [
      "Everything in Free",
      "Unlimited history & comparisons",
      "JSON report export",
      "Priority pipeline queue",
      "Keyword density tuning tips",
    ],
    cta: "Go Pro",
    href: "/analyze",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "Career centers, bootcamps, and recruiting teams.",
    features: [
      "Everything in Pro",
      "Team dashboards",
      "Custom skill taxonomy",
      "API access",
    ],
    cta: "Contact sales",
    href: "/analyze",
    featured: false,
  },
];

export default function PricingSection() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    gsap.from(scope.current!.querySelectorAll("[data-tier]"), {
      rotateY: -16,
      y: 60,
      opacity: 0,
      transformPerspective: 1100,
      stagger: 0.12,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: scope.current, start: "top 76%", once: true },
    });
  }, []);

  return (
    <section ref={scope} id="pricing" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[380px] w-[820px] -translate-x-1/2 rounded-full bg-accent/10 blur-[170px]" />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          kicker="Pricing"
          title={
            <>
              Start free. <span className="gradient-text">Upgrade when it matters.</span>
            </>
          }
          description="No accounts, no paywall between you and your first analysis."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-3 md:items-stretch">
          {TIERS.map((t) => (
            <div
              key={t.name}
              data-tier
              className={cn(
                "relative flex flex-col rounded-2xl p-7 will-change-transform",
                t.featured
                  ? "ring-conic glass-strong shadow-[0_30px_90px_-30px_rgba(99,102,241,0.5)] md:-my-3 md:scale-[1.015]"
                  : "glass",
              )}
            >
              {t.featured && (
                <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full gradient-1 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
                  <Crown className="h-3 w-3" />
                  Most popular
                </span>
              )}
              <h3 className="font-display text-lg font-semibold">{t.name}</h3>
              <div className="mt-4 flex items-end gap-1.5">
                <span className="font-display text-4xl font-bold tracking-tight">{t.price}</span>
                {t.period && <span className="pb-1.5 text-sm text-mist">{t.period}</span>}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-mist">{t.blurb}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink/85">
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        t.featured ? "text-secondary" : "text-success",
                      )}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <LinkButton
                href={t.href}
                variant={t.featured ? "primary" : "secondary"}
                className="mt-8 w-full"
              >
                {t.cta}
              </LinkButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
