"use client";

import { FileUp, ScanSearch, LayoutDashboard } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    num: "01",
    icon: FileUp,
    title: "Upload both PDFs",
    desc: "Drop your resume and the job description. Files are validated for type, size, corruption, and encryption before a byte is processed.",
    visual: "upload",
  },
  {
    num: "02",
    icon: ScanSearch,
    title: "The NLP engine runs",
    desc: "Text is cleaned, tokenized, lemmatized, POS-tagged and scanned for entities. Keywords are ranked with TF-IDF + RAKE while skills resolve through the taxonomy.",
    visual: "pipeline",
  },
  {
    num: "03",
    icon: LayoutDashboard,
    title: "Get your match report",
    desc: "A 5-signal score, skill gap grid, keyword cloud, section breakdown, ATS format check, and prioritized fixes — exportable as JSON.",
    visual: "report",
  },
] as const;

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  if (kind === "upload") {
    return (
      <div className="mt-8 flex gap-4">
        {["resume.pdf", "job.pdf"].map((f, i) => (
          <div
            key={f}
            className={cn(
              "glass flex-1 rounded-xl border-dashed p-4 text-center",
              i === 0 ? "border-primary/40" : "border-secondary/40",
            )}
          >
            <FileUp className={cn("mx-auto h-5 w-5", i === 0 ? "text-primary" : "text-secondary")} />
            <p className="mt-2 font-mono text-[10px] text-mist">{f}</p>
            <div className="mx-auto mt-3 h-1 w-3/4 overflow-hidden rounded bg-white/10">
              <div className="h-full w-full gradient-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "pipeline") {
    const stages = ["tokens", "lemmas", "entities", "keywords", "vectors", "score"];
    return (
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {stages.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[11px] text-indigo-300">
              {s}
            </span>
            {i < stages.length - 1 && <span className="text-mist/40">→</span>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-2.5">
      {[
        ["Keyword match", "w-[78%]", "#6366F1"],
        ["Semantic similarity", "w-[85%]", "#06B6D4"],
        ["Skill match", "w-[71%]", "#10B981"],
      ].map(([label, w, c]) => (
        <div key={label}>
          <div className="mb-1 flex justify-between font-mono text-[10px] text-mist">
            <span>{label}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div className={cn("h-full rounded-full", w)} style={{ background: c }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HowItWorksSection() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    const el = scope.current!;
    const mm = gsap.matchMedia();

    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const track = el.querySelector<HTMLElement>(".hiw-track")!;
      const panels = Array.from(el.querySelectorAll<HTMLElement>(".hiw-panel"));
      const dots = Array.from(el.querySelectorAll<HTMLElement>(".hiw-dot"));

      const distance = () => track.scrollWidth - window.innerWidth;

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: el.querySelector(".hiw-pinzone"),
          start: "top top",
          end: () => `+=${distance() * 1.05}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const idx = Math.min(
              panels.length - 1,
              Math.round(self.progress * (panels.length - 1)),
            );
            dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
          },
        } satisfies ScrollTrigger.Vars,
      });

      // per-panel clip reveal as they slide in
      const reveals = panels.map((panel) =>
        gsap.fromTo(
          panel.querySelector(".hiw-card"),
          { clipPath: "inset(12% 8% 12% 8% round 24px)", opacity: 0.4 },
          {
            clipPath: "inset(0% 0% 0% 0% round 24px)",
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: panel,
              containerAnimation: tween,
              start: "left 75%",
              end: "left 30%",
              scrub: true,
            } satisfies ScrollTrigger.Vars,
          },
        ),
      );

      dots[0]?.classList.add("is-active");
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        reveals.forEach((r) => {
          r.scrollTrigger?.kill();
          r.kill();
        });
      };
    });

    mm.add("(max-width: 767px)", () => {
      el.querySelectorAll(".hiw-panel").forEach((p) => {
        gsap.from(p.querySelector(".hiw-card"), {
          y: 56,
          opacity: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: p, start: "top 85%", once: true } satisfies ScrollTrigger.Vars,
        });
      });
    });
  }, []);

  return (
    <section ref={scope} id="how-it-works" className="relative">
      <div className="hiw-pinzone relative md:h-screen md:overflow-hidden">
        <div className="pointer-events-none absolute left-[-10%] top-[30%] h-[420px] w-[420px] rounded-full bg-secondary/10 blur-[140px]" />

        <div className="mx-auto max-w-7xl px-5 pt-24 sm:px-8 md:pt-28">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-secondary">
            How it works
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Two PDFs in. <span className="gradient-text">Clarity out.</span>
          </h2>
        </div>

        <div className="mt-10 md:absolute md:inset-x-0 md:top-1/2 md:mt-0 md:-translate-y-[42%]">
          <div className="hiw-track flex flex-col md:w-max md:flex-row">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="hiw-panel w-full shrink-0 px-5 pb-10 sm:px-8 md:w-[78vw] md:pb-0 lg:w-[62vw] xl:w-[54vw]"
              >
                <div className="hiw-card glass relative mx-auto max-w-2xl rounded-3xl p-8 sm:p-10">
                  <span className="pointer-events-none absolute -top-3 right-6 font-display text-7xl font-bold text-white/[0.045] sm:text-8xl">
                    {s.num}
                  </span>
                  <span className="gradient-1 flex h-12 w-12 items-center justify-center rounded-xl shadow-[0_10px_30px_-8px_rgba(99,102,241,0.6)]">
                    <s.icon className="h-5.5 w-5.5 text-white" strokeWidth={2} />
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
                    {s.desc}
                  </p>
                  <StepVisual kind={s.visual} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:absolute md:bottom-12 md:left-1/2 md:flex md:-translate-x-1/2 md:items-center md:gap-2.5">
          {STEPS.map((s) => (
            <span
              key={s.num}
              className="hiw-dot h-1.5 w-6 rounded-full bg-white/15 transition-all duration-500 [&.is-active]:w-10 [&.is-active]:bg-gradient-to-r [&.is-active]:from-primary [&.is-active]:to-secondary"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
