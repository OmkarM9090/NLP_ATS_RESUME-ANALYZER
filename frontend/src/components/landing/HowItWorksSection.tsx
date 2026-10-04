"use client";

import { useEffect, useRef } from "react";
import { FileUp, LayoutDashboard, ScanSearch } from "lucide-react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { revealOnScroll } from "@/lib/anim";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    num: "01",
    icon: FileUp,
    title: "Drop in both documents",
    body:
      "Your resume and the job posting are validated for type, size, corruption and password protection before a single byte reaches the engine.",
    visual: "upload" as const,
  },
  {
    num: "02",
    icon: ScanSearch,
    title: "The pipeline runs",
    body:
      "Text is cleaned, tokenised, lemmatised, POS-tagged and scanned for entities. Keywords are ranked with TF-IDF + RAKE while skills resolve through the taxonomy.",
    visual: "pipeline" as const,
  },
  {
    num: "03",
    icon: LayoutDashboard,
    title: "Read the report, fix the gaps",
    body:
      "Five weighted signals, a skill-gap grid, section scores, an ATS audit and prioritised fixes — exportable as JSON or copyable as a summary.",
    visual: "report" as const,
  },
];

/* ------------------------------------------------------------------ visuals */

function UploadVisual() {
  return (
    <div className="mt-7 grid grid-cols-2 gap-3">
      {[
        { name: "resume.pdf", tone: "primary" as const },
        { name: "job-posting.pdf", tone: "secondary" as const },
      ].map((f) => (
        <div
          key={f.name}
          className={cn(
            "rounded-xl border border-dashed bg-void/40 p-4",
            f.tone === "primary" ? "border-primary/35" : "border-secondary/35",
          )}
        >
          <div className="flex items-center justify-between">
            <FileUp
              className={cn("h-4 w-4", f.tone === "primary" ? "text-primary-2" : "text-secondary")}
              strokeWidth={2}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-success">
              ready
            </span>
          </div>
          <p className="mt-3 truncate font-mono text-[10.5px] text-mist">{f.name}</p>
          <span className="mt-3 block h-1 overflow-hidden rounded-full bg-tint-3">
            <span
              className={cn(
                "block h-full w-full rounded-full",
                f.tone === "primary"
                  ? "bg-gradient-to-r from-primary-2 to-primary"
                  : "bg-gradient-to-r from-secondary/70 to-secondary",
              )}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function PipelineVisual() {
  const stages = [
    { label: "tokens", value: "1,284" },
    { label: "lemmas", value: "962" },
    { label: "entities", value: "41" },
    { label: "keywords", value: "25" },
    { label: "vectors", value: "384d" },
    { label: "score", value: "83" },
  ];
  return (
    <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stages.map((s, i) => (
        <div
          key={s.label}
          className="rounded-lg border border-line-soft bg-void/40 px-3 py-2.5"
          style={{ opacity: 1 - i * 0.06 }}
        >
          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
            {s.label}
          </p>
          <p className="mt-1 font-mono text-[15px] tabular-nums text-ink">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function ReportVisual() {
  const rows = [
    { label: "Keyword match", value: 78, color: "#3B82F6" },
    { label: "Semantic similarity", value: 86, color: "#22D3EE" },
    { label: "Skill match", value: 81, color: "#34D399" },
    { label: "ATS formatting", value: 92, color: "#F0A868" },
  ];
  return (
    <div className="mt-7 space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              {r.label}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-mist">{r.value}</span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-tint-3">
            <span
              className="block h-full w-full origin-left rounded-full"
              style={{ background: r.color, transform: `scaleX(${r.value / 100})` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- section */

export default function HowItWorksSection() {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const track = el.querySelector<HTMLElement>(".hiw-track");
        const pinzone = el.querySelector<HTMLElement>(".hiw-pinzone");
        if (!track || !pinzone) return;

        /* Flip the layout into horizontal-pinned mode BEFORE measuring —
           the CSS only applies while this class is present, so the fallback
           (reduced motion, no JS) stays a plain vertical stack. */
        el.classList.add("hiw--pinned");

        const panels = gsap.utils.toArray<HTMLElement>(".hiw-panel", el);
        const dots = gsap.utils.toArray<HTMLElement>(".hiw-dot", el);
        const bar = el.querySelector<HTMLElement>(".hiw-rail-fill");
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: pinzone,
            start: "top top",
            end: () => `+=${distance() * 1.06}`,
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (bar) gsap.set(bar, { scaleX: self.progress });
              const idx = Math.min(
                panels.length - 1,
                Math.round(self.progress * (panels.length - 1)),
              );
              dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
            },
          },
        });

        panels.forEach((panel) => {
          const card = panel.querySelector(".hiw-card");
          if (!card) return;
          gsap.fromTo(
            card,
            { y: 34, opacity: 0.35, scale: 0.97 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: panel,
                containerAnimation: tween,
                start: "left 82%",
                end: "left 40%",
                scrub: true,
              },
            },
          );
        });

        dots[0]?.classList.add("is-active");
        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          el.classList.remove("hiw--pinned");
        };
      });

      mm.add("(max-width: 767px)", () => {
        const panels = gsap.utils.toArray<HTMLElement>(".hiw-panel", el);
        revealOnScroll(panels, { trigger: el, y: 40, stagger: 0.1, start: "top 82%" });
      });

      /* Reduced motion on desktop: no pin, just a calm reveal of the stack. */
      mm.add("(min-width: 768px) and (prefers-reduced-motion: reduce)", () => {
        const panels = gsap.utils.toArray<HTMLElement>(".hiw-panel", el);
        gsap.set(panels, { opacity: 1, clearProps: "transform" });
      });

      return () => mm.revert();
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} id="how-it-works" className="relative scroll-mt-24">
      <div className="hiw-pinzone relative overflow-hidden">
        <div className="pointer-events-none absolute left-[-12%] top-[28%] h-[420px] w-[420px] rounded-full bg-glow-secondary blur-[150px]" />
        <div className="pointer-events-none absolute right-[-10%] top-[6%] h-[380px] w-[380px] rounded-full bg-glow-primary blur-[150px]" />

        <div className="relative mx-auto max-w-7xl px-5 pt-24 sm:px-8 md:pt-28">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow mb-4">
                <span className="h-1 w-1 rounded-full bg-secondary" />
                how it works
              </p>
              <h2 className="display-2">
                Two documents in.{" "}
                <span className="text-gradient">A decision out.</span>
              </h2>
            </div>
            <p className="lede max-w-sm lg:pb-2">
              Roughly one second of compute per pair — on CPU, with no data
              leaving the request.
            </p>
          </div>
        </div>

        <div className="hiw-stage relative mt-10">
          <div className="hiw-track flex flex-col">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="hiw-panel w-full px-5 pb-12 sm:px-8"
              >
                <div className="hiw-card card mx-auto max-w-2xl p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-tint-4 to-tint-1 ring-1 ring-line-soft">
                      <step.icon className="h-5 w-5 text-ink/85" strokeWidth={1.9} />
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.2em] text-faint">
                      step {step.num}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-[-0.025em] sm:text-[28px]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-mist">
                    {step.body}
                  </p>
                  {step.visual === "upload" && <UploadVisual />}
                  {step.visual === "pipeline" && <PipelineVisual />}
                  {step.visual === "report" && <ReportVisual />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hiw-rail relative mx-auto mt-2 hidden max-w-7xl items-center gap-4 px-5 pb-16 sm:px-8">
          <span className="relative h-px flex-1 overflow-hidden bg-tint-4">
            <span className="hiw-rail-fill block h-full w-full origin-left scale-x-0 bg-gradient-to-r from-primary to-primary-2" />
          </span>
          <div className="flex items-center gap-2">
            {STEPS.map((s) => (
              <span
                key={s.num}
                className="hiw-dot h-1.5 w-5 rounded-full bg-tint-4 transition-all duration-500 [&.is-active]:w-9 [&.is-active]:bg-primary"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
