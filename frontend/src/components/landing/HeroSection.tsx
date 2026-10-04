"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  FileCheck2,
  Lock,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { gsap, splitText } from "@/lib/anim";
import { prefersReducedMotion } from "@/lib/gsap-config";
import { onIntroRelease } from "@/lib/intro";
import { useMouseParallax } from "@/hooks/useMagnetic";
import { LinkButton } from "@/components/ui/primitives";
import MatchEngine from "./MatchEngine";

const TRUST = [
  { icon: Lock, label: "No account needed" },
  { icon: FileCheck2, label: "PDF · DOCX · TXT" },
  { icon: ShieldCheck, label: "Never stored or shared" },
];

export default function HeroSection() {
  const scope = useRef<HTMLElement>(null);
  const parallaxRef = useMouseParallax<HTMLDivElement>(24);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const reduced = prefersReducedMotion();
    const q = gsap.utils.selector(el);

    const ctx = gsap.context(() => {
      // Nothing is hidden in CSS, so a reduced-motion visitor simply keeps the
      // resting layout — only the entrance/loco loops below are skipped.
      if (reduced) return;

      const play = () => {
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

        tl.fromTo(
          q(".hero-eyebrow"),
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          0,
        );

        // headline — word cascade on line 1, masked slide-up on line 2
        const line1 = el.querySelector<HTMLElement>(".hero-line-1");
        const line2 = el.querySelector<HTMLElement>(".hero-line-2");
        const line3 = el.querySelector<HTMLElement>(".hero-line-3");
        const words = line1 ? splitText(line1, "words") : [];
        if (words.length) {
          tl.fromTo(
            words,
            { yPercent: 118, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 1.05,
              stagger: 0.035,
              ease: "power4.out",
            },
            0.12,
          );
        } else if (line1) {
          tl.fromTo(line1, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.1);
        }
        [line2, line3].forEach((line, i) => {
          if (!line) return;
          tl.fromTo(
            line,
            { yPercent: 112, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 1.15, ease: "power4.out" },
            (words.length ? 0.32 : 0.18) + i * 0.12,
          );
        });

        tl.fromTo(
          q(".hero-sub"),
          { y: 22, opacity: 0, filter: "blur(10px)" },
          { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.9 },
          "-=0.55",
        )
          .fromTo(
            q(".hero-cta"),
            { y: 20, opacity: 0, scale: 0.97 },
            { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.08 },
            "-=0.6",
          )
          .fromTo(
            q(".hero-trust-item"),
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.07 },
            "-=0.45",
          );

        // product panel
        tl.fromTo(
          q(".hero-engine"),
          { y: 60, opacity: 0, scale: 0.96, rotateX: 8, filter: "blur(14px)" },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            rotateX: 0,
            filter: "blur(0px)",
            duration: 1.25,
            ease: "power3.out",
          },
          0.15,
        );

        tl.fromTo(
          q(".hero-metric"),
          { y: 24, opacity: 0, scale: 0.94 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, stagger: 0.12 },
          "-=0.7",
        );
      };

      const unsubscribe = onIntroRelease(play);
      return () => unsubscribe();
    }, el);

    /* Idle float on the engine panel + the quiet scroll-out. */
    const floats: gsap.core.Tween[] = [];
    if (!reduced) {
      const engine = el.querySelector(".hero-engine");
      if (engine) {
        floats.push(
          gsap.to(engine, {
            y: -12,
            duration: 4.2,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            delay: 2.4,
          }),
        );
      }
      const inner = el.querySelector(".hero-inner");
      if (inner) {
        floats.push(
          gsap.to(inner, {
            y: -70,
            opacity: 0.35,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          }),
        );
      }
    }

    return () => {
      floats.forEach((t) => t.kill());
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={scope}
      className="relative isolate overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-40"
    >
      {/* ------------------------------- backdrop ------------------------- */}
      <div ref={parallaxRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-lines [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)]" />
        <div
          data-parallax-depth="1.5"
          className="absolute -left-[12%] top-[-14%] h-[560px] w-[560px] rounded-full bg-glow-primary blur-[160px]"
        />
        <div
          data-parallax-depth="1"
          className="absolute -right-[10%] top-[6%] h-[480px] w-[480px] rounded-full bg-glow-secondary blur-[170px]"
        />
        <div
          data-parallax-depth="0.6"
          className="absolute bottom-[-18%] left-[38%] h-[380px] w-[380px] rounded-full bg-glow-primary blur-[170px]"
        />
      </div>

      <div className="hero-inner mx-auto grid w-full max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-12">
        {/* ------------------------------ copy ---------------------------- */}
        <div>
          <div className="hero-eyebrow inline-flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-line-soft bg-tint-2 py-1.5 pl-2 pr-3.5 backdrop-blur-sm">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-3 w-3 text-primary-2" strokeWidth={2.4} />
            </span>
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.2em] text-mist">
              14-stage nlp pipeline
            </span>
            <span className="h-3 w-px bg-line-strong" />
            <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.2em] text-secondary">
              ~1s per pair
            </span>
          </div>

          <h1 className="hero-headline mt-7 font-display text-[clamp(2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            <span className="block overflow-hidden pb-[0.04em]">
              <span className="hero-line-1 block">See your resume</span>
            </span>
            <span className="block overflow-hidden pb-[0.04em]">
              <span className="hero-line-2 block text-gradient">the way an ATS</span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <span className="hero-line-3 block text-gradient">actually reads it.</span>
            </span>
          </h1>

          <p className="hero-sub lede mt-6 max-w-xl">
            Upload a resume and a job description. ResumeAI runs a transparent
            NLP pipeline over both documents and returns a weighted match score,
            the exact keywords you&apos;re missing, an ATS formatting audit and
            prioritised fixes.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <LinkButton
              href="/analyze"
              size="lg"
              magnetic
              className="hero-cta group max-sm:w-full"
            >
              Analyze my resume
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </LinkButton>
            <LinkButton
              href="/analyze?sample=1"
              variant="secondary"
              size="lg"
              className="hero-cta group max-sm:w-full"
            >
              <PlayCircle className="h-4 w-4 text-secondary" strokeWidth={2.1} />
              Run the sample
            </LinkButton>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            {TRUST.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="hero-trust-item inline-flex items-center gap-2 text-[12.5px] text-faint"
              >
                <Icon className="h-3.5 w-3.5 text-mist/70" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* --------------------------- product panel ---------------------- */}
        <div className="relative">
          <div className="hero-engine relative" style={{ perspective: 1200 }}>
            <MatchEngine />

            {/* floating metric cards */}
            <div className="hero-metric absolute -left-4 bottom-14 hidden w-[168px] rounded-2xl border border-line-soft bg-panel/80 p-3.5 shadow-float backdrop-blur-xl sm:block lg:-left-10">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-success/15">
                  <Zap className="h-3 w-3 text-success" strokeWidth={2.4} />
                </span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                  matched
                </span>
              </div>
              <p className="mt-2.5 font-display text-2xl font-bold leading-none tracking-tight text-ink">
                17
                <span className="ml-1 text-[11px] font-medium text-faint">
                  skills
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {["React", "AWS", "SQL"].map((s) => (
                  <span
                    key={s}
                    className="rounded border border-success/20 bg-success/[0.08] px-1.5 py-0.5 font-mono text-[8.5px] text-success"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="hero-metric absolute -right-3 -top-5 hidden w-[150px] rounded-2xl border border-line-soft bg-panel/80 p-3.5 shadow-float backdrop-blur-xl sm:block lg:-right-8">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                ats formatting
              </span>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold leading-none tracking-tight text-secondary">
                  92
                </span>
                <span className="font-mono text-[10px] text-faint">/100</span>
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-tint-3">
                <span className="block h-full w-[92%] rounded-full bg-gradient-to-r from-secondary/70 to-secondary" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
