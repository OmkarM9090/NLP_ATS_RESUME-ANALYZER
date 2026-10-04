"use client";

import type { MouseEvent } from "react";
import {
  Brain,
  Crosshair,
  LayoutGrid,
  Lightbulb,
  ScanText,
  Waypoints,
} from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "@/lib/gsap-config";
import { GradientText } from "@/components/ui/primitives";

const FEATURES = [
  {
    icon: ScanText,
    title: "Smart Text Extraction",
    desc: "Robust PDF text-layer extraction with validation for corruption, encryption, and scanned documents — plus clear remediation guidance.",
    tag: "extract",
  },
  {
    icon: Brain,
    title: "Deep NLP Pipeline",
    desc: "Tokenization, rule-based lemmatization, POS heuristics, stop-word filtering, and gazetteer NER — every inspectable stage runs on your document.",
    tag: "nlp-core",
  },
  {
    icon: Waypoints,
    title: "Semantic Understanding",
    desc: "Sentence-coverage semantic scoring goes beyond keywords — a JD sentence about “scaling distributed systems” matches your architecture bullets.",
    tag: "semantic",
  },
  {
    icon: LayoutGrid,
    title: "Skill Taxonomy",
    desc: "120+ canonical skills with alias resolution — “k8s,” “react.js,” and “golang” all normalize, then match exactly, partially, or not at all.",
    tag: "skills",
  },
  {
    icon: Crosshair,
    title: "Gap Analysis",
    desc: "Pinpoints the exact missing keywords, required skills, weak resume sections, and experience/education shortfalls costing you interviews.",
    tag: "gaps",
  },
  {
    icon: Lightbulb,
    title: "Actionable Recommendations",
    desc: "Prioritized fixes — not generic advice. Each recommendation names the exact term to add, where to add it, and why it matters to ATS rankers.",
    tag: "report",
  },
];

function TiltCard({
  icon: Icon,
  title,
  desc,
  tag,
}: (typeof FEATURES)[number]) {
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(el, {
      rotateY: px * 7,
      rotateX: -py * 7,
      transformPerspective: 900,
      duration: 0.5,
      ease: "power2.out",
    });
    gsap.to(el.querySelector(".fc-icon"), {
      x: px * 10,
      y: py * 10,
      duration: 0.5,
    });
  };
  const onLeave = (e: MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1,0.5)" });
    gsap.to(e.currentTarget.querySelector(".fc-icon"), { x: 0, y: 0, duration: 0.8 });
  };

  return (
    <div
      data-feature-card
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="group glass relative rounded-2xl p-6 transition-colors duration-500 will-change-transform hover:border-primary/40"
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="fc-icon gradient-1 flex h-11 w-11 items-center justify-center rounded-xl shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] will-change-transform">
          <Icon className="h-5 w-5 text-white" strokeWidth={2} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist/40 transition-colors group-hover:text-secondary/70">
          {tag}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-mist">{desc}</p>
    </div>
  );
}

export default function FeaturesSection() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    const el = scope.current!;
    gsap.from(el.querySelectorAll("[data-feature-card]"), {
      y: 64,
      opacity: 0,
      rotateZ: 1.5,
      stagger: 0.09,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 72%", once: true },
    });
    gsap.from(el.querySelector(".features-heading"), {
      y: 40,
      opacity: 0,
      duration: 0.9,
      scrollTrigger: { trigger: el, start: "top 78%", once: true },
    });
  }, []);

  return (
    <section ref={scope} id="features" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[160px]" />
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
        <div className="features-heading lg:sticky lg:top-32 lg:self-start">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-secondary">
            Under the hood
          </p>
          <h2 className="font-display text-3xl font-semibold leading-[1.06] tracking-tight sm:text-4xl lg:text-5xl">
            A serious <GradientText>NLP engine</GradientText>, not a keyword counter.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mist sm:text-lg">
            Twelve inspectable stages transform two PDFs into a scored,
            explainable report. Every number on your dashboard traces back to
            real linguistic evidence.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-xl glass px-5 py-4">
            <span className="font-mono text-2xl font-bold gradient-text">5</span>
            <span className="text-sm text-mist">
              weighted scoring signals fused
              <br />
              into one match score
            </span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <TiltCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
