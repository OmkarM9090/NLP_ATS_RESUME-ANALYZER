"use client";

import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "@/lib/gsap-config";

/* ---------------------------------------------------------------------------
 * Shared animation primitives.
 *
 * Every helper is defensive: if the visitor prefers reduced motion (or the
 * target is missing) it resolves to the element's resting state instead of
 * throwing, so components can call them unconditionally.
 * ------------------------------------------------------------------------- */

export type SplitPart = "lines" | "words" | "chars";

/**
 * Split an element's text into masked line/word/char spans ready for reveal.
 * Returns the created unit elements (already wrapped so a parent overflow
 * mask clips them), or an empty array in reduced-motion mode.
 */
export function splitText(el: HTMLElement, part: SplitPart = "lines") {
  if (!el) return [] as HTMLElement[];
  const text = el.textContent ?? "";
  el.setAttribute("aria-label", text.trim());
  try {
    const split = new SplitText(el, {
      type: part === "lines" ? "lines" : part === "words" ? "words" : "chars,words",
      linesClass: "split-line",
      wordsClass: "split-word",
      charsClass: "split-char",
      mask: part === "chars" ? "words" : part,
    });
    const units =
      part === "lines" ? split.lines : part === "words" ? split.words : split.chars;
    return (units as HTMLElement[]).filter(Boolean);
  } catch {
    return [] as HTMLElement[];
  }
}

/** Masked "type set into place" reveal for headings. */
export function revealText(
  el: HTMLElement | null,
  opts: { part?: SplitPart; delay?: number; stagger?: number; y?: number } = {},
) {
  if (!el) return null;
  const { part = "lines", delay = 0, stagger = 0.08 } = opts;
  if (prefersReducedMotion()) {
    gsap.set(el, { opacity: 1 });
    return null;
  }
  const units = splitText(el, part);
  if (!units.length) {
    return gsap.fromTo(
      el,
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, delay },
    );
  }
  return gsap.fromTo(
    units,
    { yPercent: 118, opacity: 0 },
    {
      yPercent: 0,
      opacity: 1,
      duration: 1.05,
      delay,
      stagger,
      ease: "power4.out",
    },
  );
}

/** Fade + rise a group of elements when they scroll into view. */
export function revealOnScroll(
  targets: gsap.TweenTarget,
  opts: {
    trigger?: Element | null;
    y?: number;
    stagger?: number;
    delay?: number;
    duration?: number;
    start?: string;
    scale?: number;
    blur?: boolean;
  } = {},
) {
  const {
    trigger,
    y = 34,
    stagger = 0.08,
    delay = 0,
    duration = 0.95,
    start = "top 82%",
    scale,
  } = opts;

  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, clearProps: "transform,filter" });
    return null;
  }
  const elements = gsap.utils.toArray<HTMLElement>(targets);
  if (!elements.length) return null;

  return gsap.fromTo(
    elements,
    { y, opacity: 0, ...(scale ? { scale } : {}) },
    {
      y: 0,
      opacity: 1,
      ...(scale ? { scale: 1 } : {}),
      duration,
      delay,
      stagger,
      ease: "power3.out",
      scrollTrigger: {
        trigger: (trigger as Element) ?? elements[0],
        start,
        once: true,
      },
    },
  );
}

/** Set the resting (visible) state for elements that JS will animate in. */
export function primeIn(targets: gsap.TweenTarget, y = 34) {
  if (prefersReducedMotion()) return;
  gsap.set(targets, { opacity: 0, y });
}

/** Float-in with a soft blur — used for hero media and mockups. */
export function revealBlur(
  el: Element | null,
  opts: { trigger?: Element | null; delay?: number; start?: string } = {},
) {
  if (!el) return null;
  if (prefersReducedMotion()) {
    gsap.set(el, { opacity: 1 });
    return null;
  }
  const { trigger, delay = 0, start = "top 85%" } = opts;
  return gsap.fromTo(
    el,
    { opacity: 0, y: 44, filter: "blur(14px)" },
    {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 1.2,
      delay,
      ease: "power3.out",
      scrollTrigger: { trigger: (trigger as Element) ?? el, start, once: true },
    },
  );
}

/**
 * Cursor spotlight: writes --mx/--my CSS variables on the element so the
 * `.spotlight` class can paint a soft radial highlight under the pointer.
 */
export function attachSpotlight(el: HTMLElement) {
  if (prefersReducedMotion()) return () => {};
  const onMove = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };
  el.addEventListener("pointermove", onMove);
  return () => el.removeEventListener("pointermove", onMove);
}

/** Gentle 3D tilt driven by the pointer; returns a detached cleanup.
 *  Rotates only — never touches x/y/opacity, so it can coexist with the
 *  scroll-reveal and float tweens on the same element. */
export function attachTilt(el: HTMLElement, max = 6) {
  if (prefersReducedMotion()) return () => {};
  if (window.matchMedia("(pointer: coarse)").matches) return () => {};

  gsap.set(el, { transformPerspective: 1100, transformOrigin: "center center" });
  const rx = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3.out" });
  const ry = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3.out" });

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry(px * max);
    rx(-py * max);
  };
  const onLeave = () => {
    rx(0);
    ry(0);
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
  };
}

/** Per-character "decode" scramble for short mono labels. */
export function scrambleText(
  el: HTMLElement,
  final: string,
  opts: { duration?: number; delay?: number } = {},
) {
  if (prefersReducedMotion()) {
    el.textContent = final;
    return null;
  }
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%+*";
  const state = { p: 0 };
  const { duration = 1.1, delay = 0 } = opts;
  return gsap.to(state, {
    p: 1,
    duration,
    delay,
    ease: "power2.inOut",
    onUpdate: () => {
      const settled = Math.floor(state.p * final.length);
      let out = final.slice(0, settled);
      for (let i = settled; i < final.length; i++) {
        out += final[i] === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      el.textContent = out;
    },
    onComplete: () => {
      el.textContent = final;
    },
  });
}

export { gsap, ScrollTrigger };
