"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useGsapContext } from "@/hooks/useGsapContext";

const WORD = "RESUME·MATCHER";
const TOTAL_MS = 2500;

/**
 * Full-screen preloader: per-letter stagger, then a diagonal clip wipe.
 *
 * Runs once per browser session (guarded by sessionStorage) so navigating back
 * to the landing page does not replay it. Total runtime is the spec'd 2.5s.
 */
export function Preloader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [finished, setFinished] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.sessionStorage.getItem("ats-preloader-shown");
    setMounted(true);
    if (seen === "1" || reducedMotion) {
      setFinished(true);
      return;
    }
    window.sessionStorage.setItem("ats-preloader-shown", "1");
  }, [reducedMotion]);

  const scopeRef = useGsapContext(
    () => {
      const element = containerRef.current;
      if (!element) return;

      const letters = gsap.utils.toArray<HTMLSpanElement>("[data-preloader-char]", element);
      const panel = element.querySelector<HTMLElement>("[data-preloader-panel]");
      const glow = element.querySelector<HTMLElement>("[data-preloader-glow]");
      const counter = element.querySelector<HTMLElement>("[data-preloader-counter]");
      const counterProxy = { value: 0 };

      const timeline = gsap.timeline({
        defaults: { ease: "expo.out" },
        onComplete: () => setFinished(true),
      });

      timeline
        .fromTo(
          panel,
          { clipPath: "inset(0 0 0 0)" },
          { duration: 0.01, clipPath: "inset(0 0 0 0)" },
          0,
        )
        .fromTo(
          letters,
          { yPercent: 118, opacity: 0, rotate: 6 },
          {
            yPercent: 0,
            opacity: 1,
            rotate: 0,
            duration: 1.05,
            stagger: { each: 0.045, from: "start" },
          },
          0.15,
        )
        .to(
          counterProxy,
          {
            value: 100,
            duration: TOTAL_MS / 1000,
            ease: "power2.inOut",
            onUpdate: () => {
              if (counter) counter.textContent = `${Math.round(counterProxy.value)}%`;
            },
          },
          0,
        )
        .to(glow, { opacity: 0.55, scale: 1.12, duration: 1.6, ease: "sine.inOut" }, 0.2)
        .to(letters, { yPercent: -118, opacity: 0, duration: 0.6, stagger: 0.012, ease: "expo.in" }, 1.75)
        // Diagonal clip wipe revealing the page underneath.
        .to(
          panel,
          {
            clipPath: "inset(0% 0% 100% 0%) skewY(-4deg)",
            duration: 0.85,
            ease: "expo.inOut",
          },
          2.0,
        )
        .set(panel, { display: "none" });

      return () => {
        timeline.kill();
      };
    },
    { scope: containerRef, disabled: !mounted || finished || reducedMotion },
  );

  if (!mounted || finished) return null;

  return (
    <div ref={scopeRef} className="fixed inset-0 z-[100] no-print">
      <div
        ref={containerRef}
        data-preloader-panel
        className="absolute inset-0 flex flex-col items-center justify-center bg-bg-deep"
        style={{ clipPath: "inset(0 0 0 0)" }}
        aria-hidden={finished}
      >
        <div
          data-preloader-glow
          className="pointer-events-none absolute inset-0 bg-hero-glow opacity-30"
        />

        <div className="relative overflow-hidden py-2">
          <div className="flex" aria-label="Resume Matcher">
            {WORD.split("").map((char, index) => (
              <span
                key={`${char}-${index}`}
                data-preloader-char
                className="inline-block font-heading text-[10vw] leading-none font-semibold tracking-[-0.04em] text-ink sm:text-[6vw] lg:text-display"
              >
                {char === "·" ? (
                  <span className="text-primary-400">·</span>
                ) : (
                  char
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mt-10 flex w-[min(520px,72vw)] flex-col gap-3">
          <div className="h-px w-full overflow-hidden bg-line">
            <div className="h-full w-1/3 animate-[marquee_1.6s_ease-in-out_infinite_alternate] bg-gradient-to-r from-primary-500 to-secondary-400" />
          </div>
          <div className="flex items-center justify-between font-mono text-micro uppercase tracking-[0.24em] text-ink-faint">
            <span>Initialising NLP pipeline</span>
            <span data-preloader-counter className="numeric text-ink-muted">
              0%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
