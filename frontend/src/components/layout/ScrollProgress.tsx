"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap-config";

/**
 * Hairline reading-progress bar pinned to the very top of the viewport.
 * Driven by a single scroll listener with gsap.quickSetter — no React state,
 * so it never re-renders the tree while scrolling.
 */
export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || prefersReducedMotion()) return;

    const setScale = gsap.quickSetter(bar, "scaleX") as (v: number) => void;
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setScale(progress);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-px bg-transparent"
    >
      <div
        ref={barRef}
        className="h-px origin-left scale-x-0 bg-gradient-to-r from-primary-2 via-primary to-secondary"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
