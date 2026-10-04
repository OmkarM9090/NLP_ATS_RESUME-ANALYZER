"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap-config";

/** Magnetic hover: element glides toward the cursor, springs back on leave. */
export function useMagneticEffect<T extends HTMLElement = HTMLElement>(
  strength = 0.35,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      xTo(relX * strength);
      yTo(relY * strength);
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [strength]);

  return ref;
}

/** Cursor parallax: layers drift subtly with viewport-relative mouse position. */
export function useMouseParallax<T extends HTMLElement = HTMLElement>(
  intensity = 24,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const layers = Array.from(
      el.querySelectorAll<HTMLElement>("[data-parallax-depth]"),
    );
    if (!layers.length) return;

    const setters = layers.map((layer) => ({
      depth: parseFloat(layer.dataset.parallaxDepth ?? "1"),
      xTo: gsap.quickTo(layer, "x", { duration: 0.9, ease: "power2.out" }),
      yTo: gsap.quickTo(layer, "y", { duration: 0.9, ease: "power2.out" }),
    }));

    const onMove = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      for (const s of setters) {
        s.xTo(nx * intensity * s.depth);
        s.yTo(ny * intensity * s.depth);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [intensity]);

  return ref;
}
