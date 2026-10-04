"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";

/**
 * Odometer-style counter. Uses tabular figures so digits never shift width,
 * and starts when the element scrolls into view (unless startOnView={false}).
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 2,
  className,
  startOnView = true,
  format = true,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  startOnView?: boolean;
  format?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const state = { v: 0 };
    const render = () => {
      const v = state.v.toFixed(decimals);
      el.textContent =
        prefix + (format ? Number(v).toLocaleString("en-US") : v) + suffix;
    };
    render();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      state.v = value;
      render();
      return;
    }

    const tween = gsap.to(state, {
      v: value,
      duration,
      ease: "power2.out",
      onUpdate: render,
      paused: startOnView,
    });

    if (!startOnView) {
      tween.play();
      return () => tween.kill();
    }

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () => tween.play(),
    });

    return () => {
      st.kill();
      tween.kill();
    };
  }, [value, decimals, suffix, prefix, duration, startOnView, format]);

  return <span ref={ref} className={cn("tabular-nums", className)} />;
}
