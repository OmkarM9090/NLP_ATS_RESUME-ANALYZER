"use client";

import { useState } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "@/lib/gsap-config";

export const PRELOADER_FLAG = "resumeai:preloaded";
const LETTERS = "RESUME".split("");

export default function Preloader() {
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(PRELOADER_FLAG);
  });

  const scope = useGSAP<HTMLDivElement>(({ scope }) => {
    if (!active || !scope.current) return;
    const el = scope.current;

    document.documentElement.style.overflow = "hidden";

    const tl = gsap.timeline({
      defaults: { ease: "power4.out" },
      onComplete: () => {
        document.documentElement.style.overflow = "";
        sessionStorage.setItem(PRELOADER_FLAG, "1");
        setActive(false);
      },
    });

    tl.fromTo(
      el.querySelectorAll(".pl-letter"),
      { yPercent: 120, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.055 },
      0.15,
    )
      .fromTo(
        el.querySelector(".pl-sub"),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5 },
        0.9,
      )
      .fromTo(
        el.querySelector(".pl-bar-fill"),
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.9,
          ease: "power2.inOut",
          transformOrigin: "left center",
        },
        0.95,
      )
      .to(
        el.querySelectorAll(".pl-letter, .pl-sub, .pl-bar"),
        { yPercent: -60, opacity: 0, duration: 0.45, stagger: 0.02, ease: "power2.in" },
        2.05,
      )
      .to(
        el,
        {
          clipPath: "polygon(0 0, 100% 0, 100% 0, 0 0)",
          duration: 0.75,
          ease: "power4.inOut",
        },
        2.3,
      );
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={scope}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-night"
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
      aria-hidden
    >
      <div className="flex overflow-hidden pb-1 font-display text-4xl font-bold tracking-tight sm:text-6xl">
        {LETTERS.map((l, i) => (
          <span key={i} className="pl-letter inline-block">
            {l}
          </span>
        ))}
        <span className="pl-letter gradient-text ml-2 inline-block">AI</span>
      </div>
      <p className="pl-sub mt-3 font-mono text-[11px] uppercase tracking-[0.4em] text-mist">
        NLP Resume Analyzer
      </p>
      <div className="pl-bar mt-8 h-px w-56 bg-white/10">
        <div className="pl-bar-fill h-full w-full gradient-1" />
      </div>
    </div>
  );
}
