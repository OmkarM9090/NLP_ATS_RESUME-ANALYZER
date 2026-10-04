"use client";

import { useEffect } from "react";
import { ArrowRight, ChevronDown, FileText, Gauge, Sparkles, Zap } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { useMouseParallax } from "@/hooks/useMagnetic";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { LinkButton } from "@/components/ui/primitives";
import { PRELOADER_FLAG } from "./Preloader";

/** Split element text into animated char spans (descender-safe). */
function splitIntoChars(el: HTMLElement) {
  const text = el.textContent ?? "";
  el.textContent = "";
  el.setAttribute("aria-label", text);
  const frag = document.createDocumentFragment();
  for (const word of text.split(" ")) {
    const w = document.createElement("span");
    w.className = "inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-top";
    for (const ch of word) {
      const c = document.createElement("span");
      c.className = "hero-char inline-block will-change-transform";
      c.textContent = ch;
      w.appendChild(c);
    }
    frag.appendChild(w);
    frag.appendChild(document.createTextNode(" "));
  }
  el.appendChild(frag);
}

const BADGES = [
  { icon: Gauge, text: "5-dimension scoring", cls: "lg:left-[6%] lg:top-[26%] left-4 top-[18%]", depth: 1.4, delay: "0s" },
  { icon: Zap, text: "Sub-second NLP pipeline", cls: "lg:right-[4%] lg:top-[22%] right-4 top-[12%]", depth: 0.9, delay: "1.2s" },
  { icon: FileText, text: "Smart PDF extraction", cls: "lg:left-[8%] lg:bottom-[24%] left-6 bottom-[16%]", depth: 1.1, delay: "2s" },
];

export default function HeroSection() {
  const parallaxRef = useMouseParallax<HTMLDivElement>(34);

  const scope = useGSAP<HTMLElement>(({ scope }) => {
    const el = scope.current!;
    const lines = el.querySelectorAll<HTMLElement>(".hero-line");
    lines.forEach(splitIntoChars);
    const chars = el.querySelectorAll(".hero-char");

    const delay =
      typeof window !== "undefined" && !sessionStorage.getItem(PRELOADER_FLAG)
        ? 3.0
        : 0.15;

    const tl = gsap.timeline({ delay, defaults: { ease: "power4.out" } });
    tl.fromTo(
      el.querySelector(".hero-kicker"),
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7 },
    )
      .fromTo(
        chars,
        { yPercent: 118, rotateZ: 5 },
        { yPercent: 0, rotateZ: 0, duration: 1.05, stagger: 0.028 },
        "-=0.35",
      )
      .fromTo(
        el.querySelector(".hero-sub"),
        { y: 26, opacity: 0, filter: "blur(12px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.9 },
        "-=0.55",
      )
      .fromTo(
        el.querySelectorAll(".hero-cta"),
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.85, ease: "elastic.out(1, 0.55)", stagger: 0.09 },
        "-=0.45",
      )
      .fromTo(
        el.querySelectorAll(".hero-badge"),
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 },
        "-=0.7",
      )
      .fromTo(
        el.querySelector(".hero-card"),
        { y: 60, opacity: 0, rotateZ: 9 },
        { y: 0, opacity: 1, rotateZ: 6, duration: 1.1 },
        "-=0.8",
      )
      .fromTo(
        el.querySelector(".hero-scroll"),
        { opacity: 0 },
        { opacity: 1, duration: 0.6 },
        "-=0.3",
      );

    // subtle parallax-out on scroll
    gsap.to(el.querySelector(".hero-inner"), {
      yPercent: -12,
      opacity: 0.25,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "bottom top",
        scrub: true,
      } satisfies ScrollTrigger.Vars,
    });
  }, []);

  useEffect(() => {
    // idle float for the resume card (CSS handles badges)
    const card = scope.current?.querySelector(".hero-card");
    if (!card) return;
    const t = gsap.to(card, {
      y: "-=14",
      duration: 3.4,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      delay: 4,
    });
    return () => {
      t.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={scope}
      className="relative flex min-h-screen items-center overflow-hidden pt-20"
    >
      {/* backdrop layers */}
      <div ref={parallaxRef} className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-lines [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,black,transparent)]" />
        <div
          data-parallax-depth="1.6"
          className="absolute -left-40 top-[8%] h-[540px] w-[540px] rounded-full bg-primary/25 blur-[140px]"
        />
        <div
          data-parallax-depth="1.1"
          className="absolute -right-36 top-[34%] h-[460px] w-[460px] rounded-full bg-secondary/20 blur-[150px]"
        />
        <div
          data-parallax-depth="0.7"
          className="absolute bottom-[-10%] left-[34%] h-[380px] w-[380px] rounded-full bg-accent/15 blur-[150px]"
        />
      </div>

      {/* floating badges */}
      {BADGES.map(({ icon: Icon, text, cls, depth, delay }) => (
        <div
          key={text}
          data-parallax-depth={depth}
          className={`hero-badge animate-float absolute z-10 hidden items-center gap-2 rounded-full glass px-4 py-2 text-xs font-medium text-mist sm:flex ${cls}`}
          style={{ animationDelay: delay, animationDuration: "6.5s" }}
        >
          <Icon className="h-3.5 w-3.5 text-secondary" />
          {text}
        </div>
      ))}

      {/* floating resume card */}
      <div
        data-parallax-depth="0.55"
        className="hero-card absolute right-[7%] top-1/2 z-10 hidden w-[290px] -translate-y-1/2 rotate-6 xl:block"
      >
        <div className="glass rounded-2xl p-5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-3">
            <div className="gradient-1 h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-3/4 rounded bg-white/20" />
              <div className="h-2 w-1/2 rounded bg-white/10" />
            </div>
            <div className="relative h-11 w-11">
              <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                <circle cx="22" cy="22" r="19" stroke="#1E293B" strokeWidth="4" fill="none" />
                <circle
                  cx="22" cy="22" r="19" stroke="url(#heroGauge)" strokeWidth="4" fill="none"
                  strokeLinecap="round" strokeDasharray="119.4" strokeDashoffset="15.5"
                />
                <defs>
                  <linearGradient id="heroGauge" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-success">
                87
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-full rounded bg-white/10" />
            <div className="h-1.5 w-11/12 rounded bg-white/10" />
            <div className="h-1.5 w-4/5 rounded bg-white/10" />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {["React", "TypeScript", "AWS", "Node.js"].map((s) => (
              <span key={s} className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                {s}
              </span>
            ))}
            <span className="rounded-md border border-danger/30 bg-danger/10 px-2 py-0.5 font-mono text-[10px] text-red-300">
              Kubernetes
            </span>
          </div>
        </div>
      </div>

      {/* main content */}
      <div className="hero-inner relative z-20 mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <div className="hero-kicker mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            NLP-powered ATS resume analysis
          </div>

          <h1 className="font-display text-[13vw] font-semibold leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.2rem]">
            <span className="hero-line block">Match your resume</span>
            <span className="hero-line gradient-text block pb-2">to any job.</span>
          </h1>

          <p className="hero-sub mt-7 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
            Upload your resume and a job description. Our pipeline tokenizes,
            lemmatizes, extracts entities, matches skills against a curated
            taxonomy, and fuses five scoring signals into one actionable
            match report — in about a second.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <LinkButton href="/analyze" size="lg" magnetic className="hero-cta group">
              Analyze your resume
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </LinkButton>
            <a
              href="#how-it-works"
              className="hero-cta inline-flex h-14 items-center gap-2 rounded-xl border border-slate-500/40 px-8 font-display text-base font-semibold text-ink backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-secondary/70 hover:text-secondary"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.25em] text-mist/60">
            Free · No sign-up · PDF only
          </p>
        </div>
      </div>

      <div className="hero-scroll absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
        <div className="flex flex-col items-center gap-2 text-mist/60">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">scroll</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
