"use client";

import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "@/lib/gsap-config";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";

const STATS = [
  { value: 10000, suffix: "+", label: "Resumes analyzed", mono: true },
  { value: 95, suffix: "%", label: "Keyword precision", mono: true },
  { value: 12, suffix: "", label: "NLP pipeline stages", mono: true },
  { value: 1, suffix: "s", prefix: "< ", label: "Typical analysis time", mono: true },
];

export default function StatsSection() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    gsap.from(scope.current!.querySelectorAll("[data-stat]"), {
      y: 36,
      opacity: 0,
      stagger: 0.1,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: scope.current, start: "top 80%", once: true },
    });
  }, []);

  return (
    <section ref={scope} className="relative border-y border-line/60 bg-panel py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(99,102,241,0.14),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 px-5 sm:px-8 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} data-stat className="text-center">
            <div className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="gradient-text">
                <AnimatedCounter
                  value={s.value}
                  suffix={s.suffix}
                  prefix={s.prefix ?? ""}
                  startOnView
                />
              </span>
            </div>
            <p className="mt-3 text-sm text-mist">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
