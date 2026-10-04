"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export interface MagneticOptions {
  /** How far the element follows the cursor, in pixels. */
  strength?: number;
  /** Disable entirely (reduced motion / small screens). */
  disabled?: boolean;
  /** Selector for an inner element that should move a little more. */
  innerSelector?: string;
}

/**
 * Magnetic hover: the element drifts toward the cursor and springs back on leave.
 *
 * Used by the feature cards and the primary CTAs. Implemented with GSAP
 * quickTo so the motion stays on the compositor, and fully reverted on unmount.
 */
export function useMagnetic<T extends HTMLElement = HTMLDivElement>(options: MagneticOptions = {}) {
  const { strength = 18, disabled = false, innerSelector } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled || typeof window === "undefined") return;
    if (window.matchMedia?.("(hover: none)").matches) return; // touch devices

    const inner = innerSelector ? element.querySelector<HTMLElement>(innerSelector) : null;

    const xTo = gsap.quickTo(element, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(element, "y", { duration: 0.6, ease: "power3.out" });
    const innerX = inner ? gsap.quickTo(inner, "x", { duration: 0.7, ease: "power3.out" }) : null;
    const innerY = inner ? gsap.quickTo(inner, "y", { duration: 0.7, ease: "power3.out" }) : null;

    const onMove = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const relativeX = event.clientX - (rect.left + rect.width / 2);
      const relativeY = event.clientY - (rect.top + rect.height / 2);
      const dx = (relativeX / (rect.width / 2)) * strength;
      const dy = (relativeY / (rect.height / 2)) * strength;
      xTo(dx);
      yTo(dy);
      innerX?.(dx * 0.5);
      innerY?.(dy * 0.5);
    };

    const onLeave = () => {
      xTo(0);
      yTo(0);
      innerX?.(0);
      innerY?.(0);
    };

    element.addEventListener("mousemove", onMove);
    element.addEventListener("mouseleave", onLeave);

    return () => {
      element.removeEventListener("mousemove", onMove);
      element.removeEventListener("mouseleave", onLeave);
      gsap.set([element, inner].filter(Boolean), { clearProps: "transform" });
    };
  }, [disabled, innerSelector, strength]);

  return ref;
}
