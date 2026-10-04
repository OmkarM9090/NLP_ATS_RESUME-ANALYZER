"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, FileText, Plus, ScanLine } from "lucide-react";
import { gsap, prefersReducedMotion } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * MatchEngine — the product's signature animation.
 *
 * A live mock of what the pipeline does: the job description is scanned, its
 * requirement chips are "extracted" and then physically travel into the resume
 * card (matched) or fall into the gap tray (missing), while the five weighted
 * signals fill and the match score counts up. Everything is computed from the
 * real DOM geometry on each loop, so it stays correct at any breakpoint.
 * ------------------------------------------------------------------------- */

type Keyword = { text: string; matched: boolean; w: number };

const KEYWORDS: Keyword[] = [
  { text: "React", matched: true, w: 62 },
  { text: "TypeScript", matched: true, w: 84 },
  { text: "AWS", matched: true, w: 56 },
  { text: "GraphQL", matched: true, w: 76 },
  { text: "Kubernetes", matched: false, w: 92 },
  { text: "Terraform", matched: false, w: 82 },
];

const SIGNALS = [
  { label: "Keyword", value: 78 },
  { label: "Semantic", value: 86 },
  { label: "Skills", value: 81 },
  { label: "Experience", value: 88 },
  { label: "Education", value: 100 },
];

const TARGET_SCORE = 83;

export default function MatchEngine({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;

    /* Palette read from the active theme's tokens — the motion itself is
       untouched, it just inherits the current mode. */
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const get = (name: string, fallback: string) =>
        cs.getPropertyValue(name).trim() || fallback;
      return {
        line: get("--t-me-line", "rgba(255,255,255,0.07)"),
        lineActive: get("--t-me-line-active", "rgba(126,231,211,0.45)"),
        bullet: get("--t-me-bullet", "rgba(255,255,255,0.16)"),
      };
    };
    let token = readTokens();

    const chips = Array.from(stage.querySelectorAll<HTMLElement>("[data-chip]"));
    const bullets = Array.from(stage.querySelectorAll<HTMLElement>("[data-bullet]"));
    const bars = Array.from(stage.querySelectorAll<HTMLElement>("[data-bar-fill]"));
    const values = Array.from(stage.querySelectorAll<HTMLElement>("[data-bar-value]"));
    const counter = { v: 0 };

    const ringLength = ringRef.current?.getTotalLength?.() ?? 0;
    const setScore = (v: number) => {
      if (scoreRef.current) scoreRef.current.textContent = String(Math.round(v));
      if (ringRef.current && ringLength) {
        gsap.set(ringRef.current, {
          strokeDasharray: ringLength,
          strokeDashoffset: ringLength * (1 - v / 100),
        });
      }
    };

    /* ---------------------- resting (reduced-motion) state ---------------- */
    if (prefersReducedMotion()) {
      const layerRect = layer.getBoundingClientRect();
      chips.forEach((chip) => {
        const name = chip.dataset.chip!;
        const home = stage.querySelector<HTMLElement>(`[data-home="${name}"]`);
        if (!home) {
          gsap.set(chip, { opacity: 1 });
          return;
        }
        const h = home.getBoundingClientRect();
        chip.style.width = `${Math.max(h.width, 44)}px`;
        gsap.set(chip, {
          x: h.left - layerRect.left,
          y: h.top - layerRect.top,
          opacity: 1,
          scale: 1,
        });
      });
      bars.forEach((bar, i) => gsap.set(bar, { scaleX: SIGNALS[i].value / 100 }));
      values.forEach((v, i) => (v.textContent = `${SIGNALS[i].value}`));
      setScore(TARGET_SCORE);
      return;
    }

    let ctx: gsap.Context | null = null;
    let resizeTimer: ReturnType<typeof setTimeout>;

    const layout = () => {
      const layerRect = layer.getBoundingClientRect();
      return chips.map((chip) => {
        const name = chip.dataset.chip!;
        const home = stage.querySelector<HTMLElement>(`[data-home="${name}"]`);
        const target = stage.querySelector<HTMLElement>(
          `[data-${chip.dataset.matched === "1" ? "target" : "gap"}="${name}"]`,
        );
        if (!home || !target) return null;
        const h = home.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        chip.style.width = `${Math.max(h.width, 44)}px`;
        return {
          chip,
          matched: chip.dataset.matched === "1",
          from: { x: h.left - layerRect.left, y: h.top - layerRect.top },
          to: { x: t.left - layerRect.left, y: t.top - layerRect.top },
          mid: {
            x: (h.left + t.left) / 2 - layerRect.left + (chip.dataset.matched === "1" ? -18 : 46),
            y: Math.min(h.top, t.top) - layerRect.top - 54,
          },
        };
      });
    };

    const build = () => {
      token = readTokens();
      const frames = layout().filter(Boolean) as NonNullable<ReturnType<typeof layout>[number]>[];
      if (!frames.length) return;

      ctx?.revert();
      ctx = gsap.context(() => {
        /* Initial state. The timeline resets everything itself at position 0
           so every repeat replays from a clean slate. */
        frames.forEach((f) =>
          gsap.set(f.chip, { x: f.from.x, y: f.from.y, opacity: 0, scale: 0.92 }),
        );
        gsap.set(bullets, { scaleX: 0.5, opacity: 0.45, transformOrigin: "left center" });
        gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
        setScore(0);

        const master = gsap.timeline({
          repeat: -1,
          repeatDelay: 0.6,
          defaults: { ease: "power3.out" },
        });

        /* 0 · reset (runs on every loop) -------------------------------- */
        frames.forEach((f) =>
          master.set(
            f.chip,
            { x: f.from.x, y: f.from.y, opacity: 0, scale: 0.92, boxShadow: "none" },
            0,
          ),
        );
        master
          .set(bullets, { scaleX: 0.5, opacity: 0.45 }, 0)
          .set(bars, { scaleX: 0 }, 0)
          .set(values, { textContent: "0" }, 0)
          .set(".me-jd-line", { backgroundColor: token.line }, 0)
          .add(() => setScore(0), 0);

        /* 1 · the JD gets scanned --------------------------------------- */
        master
          .fromTo(
            ".me-beam",
            { y: -30, opacity: 0 },
            { y: 70, opacity: 1, duration: 1.25, ease: "power1.inOut" },
            0,
          )
          .to(".me-beam", { opacity: 0, duration: 0.3 }, 1.2)
          .to(
            ".me-jd-line",
            {
              backgroundColor: token.lineActive,
              stagger: 0.08,
              duration: 0.22,
            },
            0.25,
          )
          .to(
            ".me-jd-line",
            {
              backgroundColor: token.line,
              stagger: 0.08,
              duration: 0.5,
            },
            0.7,
          );

        /* 2 + 3 · chips are extracted, then travel to their destination -- */
        frames.forEach((f, i) => {
          const showAt = 0.55 + i * 0.11;
          const at = 1.5 + i * 0.26;
          master
            .to(
              f.chip,
              { opacity: 1, scale: 1, duration: 0.42, ease: "back.out(2)" },
              showAt,
            )
            .to(f.chip, { x: f.mid.x, y: f.mid.y, duration: 0.5, ease: "power2.out" }, at)
            .to(f.chip, { x: f.to.x, y: f.to.y, duration: 0.44, ease: "power3.in" }, at + 0.5)
            .to(f.chip, { y: f.to.y - 4, duration: 0.16, ease: "power2.out" }, at + 0.94)
            .to(f.chip, { y: f.to.y, duration: 0.34, ease: "power3.out" }, at + 1.1)
            .to(
              f.chip,
              {
                boxShadow: f.matched
                  ? "0 0 0 1px rgba(52,211,153,0.5), 0 10px 26px -12px rgba(52,211,153,0.7)"
                  : "0 0 0 1px rgba(244,184,96,0.45), 0 10px 26px -12px rgba(244,184,96,0.6)",
                duration: 0.3,
              },
              at + 1.1,
            );
        });

        /* 4 · resume bullets ink in as their chips land ------------------ */
        bullets.forEach((b, i) => {
          master.to(
            b,
            {
              scaleX: 1,
              opacity: 1,
              backgroundColor: token.bullet,
              duration: 0.6,
            },
            1.9 + i * 0.26,
          );
        });

        /* 5 · signals + score tick up ----------------------------------- */
        master
          .to(
            counter,
            {
              v: TARGET_SCORE,
              duration: 2.2,
              ease: "power2.out",
              onUpdate: () => setScore(counter.v),
            },
            2.2,
          )
          .to(bars, { scaleX: 1, duration: 0.9, stagger: 0.09, ease: "power3.out" }, 2.3);

        values.forEach((v, i) => {
          const obj = { n: 0 };
          master.to(
            obj,
            {
              n: SIGNALS[i].value,
              duration: 0.9,
              ease: "power2.out",
              onUpdate: () => (v.textContent = String(Math.round(obj.n))),
            },
            2.3 + i * 0.09,
          );
        });

        master.set(counter, { v: 0 }, 0);
        master.to({}, { duration: 1.6 });
      }, stage);
    };

    const start = () => build();

    if (document.fonts?.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      start();
    }

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        build();
      }, 220);
    };
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      ctx?.revert();
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className={cn(
        "engine-shell relative overflow-hidden rounded-[18px]",
        className,
      )}
    >
      {/* window chrome */}
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-tint-4" />
          <span className="h-2.5 w-2.5 rounded-full bg-tint-4" />
          <span className="h-2.5 w-2.5 rounded-full bg-tint-4" />
        </div>
        <p className="font-mono text-[10.5px] tracking-tight text-faint">
          resume-vs-jd<span className="text-faint">.analysis</span>
        </p>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-success ring-1 ring-success/25">
          <span className="h-1 w-1 animate-pulse rounded-full bg-success" />
          live
        </span>
      </div>

      <div className="relative p-3.5 sm:p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* ------------------------------ RESUME ------------------------ */}
          <div className="relative rounded-xl border border-line-soft bg-void/50 p-3">
            <div className="mb-3 flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-primary-2" strokeWidth={2.2} />
              <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist">
                resume.pdf
              </span>
            </div>

            <div className="space-y-1.5">
              {[100, 78, 88].map((w, i) => (
                <span
                  key={i}
                  data-bullet
                  className="block h-1.5 rounded-full bg-tint-3"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>

            <p className="mb-2 mt-4 font-mono text-[8.5px] uppercase tracking-[0.2em] text-faint">
              matched
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {KEYWORDS.filter((k) => k.matched).map((k) => (
                <span
                  key={k.text}
                  data-target={k.text}
                  className="block h-5 rounded-md border border-dashed border-line-soft"
                />
              ))}
            </div>

            <p className="mb-2 mt-3 font-mono text-[8.5px] uppercase tracking-[0.2em] text-warning/70">
              gaps
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {KEYWORDS.filter((k) => !k.matched).map((k) => (
                <span
                  key={k.text}
                  data-gap={k.text}
                  className="block h-5 rounded-md border border-dashed border-line-soft"
                />
              ))}
            </div>
          </div>

          {/* --------------------------- JOB DESCRIPTION ------------------ */}
          <div className="relative overflow-hidden rounded-xl border border-line-soft bg-void/50 p-3">
            <div className="mb-3 flex items-center gap-1.5">
              <ScanLine className="h-3 w-3 text-secondary" strokeWidth={2.2} />
              <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist">
                job-posting.pdf
              </span>
            </div>

            <div className="relative space-y-1.5">
              {[92, 66, 84, 74, 58].map((w, i) => (
                <span
                  key={i}
                  className="me-jd-line block h-1.5 rounded-full bg-tint-3"
                  style={{ width: `${w}%` }}
                />
              ))}
              {/* scan beam */}
              <span className="me-beam pointer-events-none absolute inset-x-[-10px] top-0 h-6 rounded-full bg-[linear-gradient(180deg,transparent,var(--t-glow-primary),transparent)] ring-1 ring-primary/25" />
            </div>

            <p className="mb-2 mt-4 font-mono text-[8.5px] uppercase tracking-[0.2em] text-faint">
              extracted
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KEYWORDS.map((k) => (
                <span
                  key={k.text}
                  data-home={k.text}
                  className="h-5 rounded-md border border-dashed border-line-soft"
                  style={{ width: k.w }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------- signals ------------------------ */}
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line-soft bg-void/50 p-3">
          <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90">
              <circle cx="26" cy="26" r="21" fill="none" className="stroke-track" strokeWidth="4" />
              <circle
                ref={ringRef}
                cx="26"
                cy="26"
                r="21"
                fill="none"
                stroke="url(#me-ring)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="131.9"
                strokeDashoffset="131.9"
              />
              <defs>
                <linearGradient id="me-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--t-primary-2)" }} />
                  <stop offset="100%" style={{ stopColor: "var(--t-primary)" }} />
                </linearGradient>
              </defs>
            </svg>
            <span
              ref={scoreRef}
              className="absolute font-mono text-[15px] font-bold tabular-nums text-ink"
            >
              0
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-[7px]">
            {SIGNALS.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-[62px] shrink-0 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                  {s.label}
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-tint-3">
                  <span
                    data-bar-fill
                    data-score={s.value}
                    className="block h-full origin-left rounded-full bg-gradient-to-r from-primary to-primary-2"
                    style={{ width: `${s.value}%`, transform: "scaleX(0)" }}
                  />
                </span>
                <span
                  data-bar-value
                  className="w-[18px] shrink-0 text-right font-mono text-[9px] tabular-nums text-mist"
                >
                  0
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --------------------------- flight layer ------------------------- */}
      <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10">
        {KEYWORDS.map((k) => (
          <span
            key={k.text}
            data-chip={k.text}
            data-matched={k.matched ? "1" : "0"}
            style={{ opacity: 0 }}
            className={cn(
              "absolute left-0 top-0 inline-flex h-5 items-center justify-center gap-1 overflow-hidden rounded-md px-1.5 font-mono text-[9.5px] font-medium tracking-tight",
              k.matched
                ? "bg-success/[0.14] text-success ring-1 ring-success/30"
                : "bg-warning/[0.14] text-warning ring-1 ring-warning/30",
            )}
          >
            {k.matched ? (
              <CircleCheck className="h-2.5 w-2.5 shrink-0" strokeWidth={2.6} />
            ) : (
              <Plus className="h-2.5 w-2.5 shrink-0" strokeWidth={2.6} />
            )}
            <span className="truncate">{k.text}</span>
          </span>
        ))}
      </div>

      {/* status line */}
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-2.5">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
          scanning · extracting · matching
        </p>
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
          pipeline · 14 stages
        </p>
      </div>
    </div>
  );
}
