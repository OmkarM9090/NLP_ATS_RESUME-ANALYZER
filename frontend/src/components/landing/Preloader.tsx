"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap-config";
import {
  introPlayed,
  markIntroPlayed,
  releaseIntro,
  onIntroRelease,
} from "@/lib/intro";

/** Kept for backwards compatibility with earlier imports. */
export const PRELOADER_FLAG = "resumeai:intro-done";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Preloader() {
  const [active, setActive] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const decidedRef = useRef(false);

  /* Decide before first paint whether the intro should play at all. */
  useIsomorphicLayoutEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    if (introPlayed() || prefersReducedMotion()) {
      markIntroPlayed();
      setActive(false);
      releaseIntro();
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const el = rootRef.current;
    if (!el) return;

    document.documentElement.style.overflow = "hidden";
    const counter = { v: 0 };
    const restore = () => {
      document.documentElement.style.overflow = "";
    };

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        restore();
        markIntroPlayed();
        setActive(false);
        // the scroll lock is gone — re-measure triggers for the pinned section
        ScrollTrigger.refresh();
      },
    });

    tl.fromTo(
      ".pl-mark",
      { scale: 0.7, opacity: 0, rotate: -12 },
      { scale: 1, opacity: 1, rotate: 0, duration: 0.75, ease: "back.out(1.6)" },
      0,
    )
      .fromTo(
        ".pl-word",
        { yPercent: 120, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.04 },
        0.12,
      )
      .to(
        counter,
        {
          v: 100,
          duration: 1.15,
          ease: "power2.inOut",
          onUpdate: () => {
            if (counterRef.current)
              counterRef.current.textContent = String(Math.round(counter.v)).padStart(3, "0");
          },
        },
        0.2,
      )
      .fromTo(".pl-bar-fill", { scaleX: 0 }, { scaleX: 1, duration: 1.15, ease: "power2.inOut" }, 0.2)
      .to(".pl-meta", { opacity: 0, y: -10, duration: 0.35 }, 1.5)
      .to(
        ".pl-line",
        { yPercent: -110, opacity: 0, duration: 0.5, stagger: 0.03, ease: "power2.in" },
        1.55,
      )
      .to(".pl-progress", { opacity: 0, duration: 0.3 }, 1.6)
      .add(() => releaseIntro(), 1.78)
      .to(
        el,
        {
          clipPath: "inset(0% 0% 100% 0%)",
          duration: 0.85,
          ease: "expo.inOut",
        },
        1.85,
      )
      .to(el, { autoAlpha: 0, duration: 0.1 }, 2.6);

    return () => {
      tl.kill();
      restore();
    };
  }, [active]);

  /* Safety net: never leave the page scroll-locked if something stalls. */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!introPlayed()) {
        markIntroPlayed();
        releaseIntro();
      }
      document.documentElement.style.overflow = "";
    }, 4200);
    return () => clearTimeout(t);
  }, []);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-void"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-glow-primary blur-[130px]" />

      <div className="relative flex items-center gap-3">
        <span className="pl-mark flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-primary to-primary-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H16l4 4v10.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V7Z" />
            <path d="M7 12h7M7 16h4" />
          </svg>
        </span>
        <div className="flex overflow-hidden pb-1 font-display text-[30px] font-bold leading-none tracking-[-0.04em]">
          {"RESUME".split("").map((l, i) => (
            <span key={i} className="pl-word pl-line inline-block">
              {l}
            </span>
          ))}
          <span className="pl-word pl-line text-gradient-mint ml-1.5 inline-block">AI</span>
        </div>
      </div>

      <div className="pl-progress mt-9 w-[240px] max-w-[62vw]">
        <div className="mb-2.5 flex items-center justify-between pl-meta">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-faint">
            loading engine
          </span>
          <span
            ref={counterRef}
            className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-mist"
          >
            000
          </span>
        </div>
        <div className="h-px w-full overflow-hidden bg-tint-4">
          <span className="pl-bar-fill block h-full w-full origin-left scale-x-0 bg-gradient-to-r from-primary via-primary-2 to-primary" />
        </div>
        <p className="pl-meta mt-3 font-mono text-[9.5px] uppercase tracking-[0.22em] text-faint/70">
          tokenize · lemmatize · match
        </p>
      </div>
    </div>
  );
}

/** Re-export so older imports keep working. */
export { onIntroRelease };
