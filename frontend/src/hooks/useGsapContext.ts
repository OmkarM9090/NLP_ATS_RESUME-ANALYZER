"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

type ContextCallback = (context: gsap.Context) => void | (() => void);

export interface UseGsapContextOptions<T extends HTMLElement = HTMLDivElement> {
  /** Scope element for gsap.context() — selectors resolve inside it only. */
  scope?: React.RefObject<T>;
  /** Skip all animation (e.g. reduced-motion users). */
  disabled?: boolean;
  /** Dependencies that should rebuild the timeline. */
  deps?: unknown[];
}

/**
 * GSAP lifecycle wrapper.
 *
 * Guarantees the two things every section on this site needs:
 *
 * 1. **Cleanup** — `gsap.context().revert()` on unmount, so no orphaned
 *    ScrollTriggers or inline styles survive a route change.
 * 2. **Refresh** — `ScrollTrigger.refresh()` after fonts/images settle and on
 *    every navigation, because pinned measurements go stale otherwise.
 *
 * The returned ref is the default scope; pass `scope` to override it.
 */
export function useGsapContext<T extends HTMLElement = HTMLDivElement>(
  callback: ContextCallback,
  options: UseGsapContextOptions<T> = {},
): React.RefObject<T> {
  const { scope, disabled = false, deps = [] } = options;
  const innerRef = useRef<T>(null);
  const scopeRef = scope ?? innerRef;
  const pathname = usePathname();
  // Keep the latest callback without re-running the effect on every render.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    const element = scopeRef.current;
    if (!element) return;

    const context = gsap.context(() => {
      const cleanup = callbackRef.current(context);
      if (typeof cleanup === "function") context.add(() => {}, cleanup);
    }, element);

    // Fonts and images shift layout after mount; re-measure once they settle.
    const refreshTimers = [
      window.setTimeout(() => ScrollTrigger.refresh(), 120),
      window.setTimeout(() => ScrollTrigger.refresh(), 600),
    ];

    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready
        .then(() => ScrollTrigger.refresh())
        .catch(() => undefined);
    }

    return () => {
      refreshTimers.forEach((timer) => window.clearTimeout(timer));
      context.revert();
    };
    // `pathname` forces a rebuild after client-side navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, pathname, scopeRef, ...deps]);

  return scopeRef;
}

/**
 * Refresh every ScrollTrigger after a route change. Mounted once in the root
 * layout so pinned sections never measure a stale document height.
 */
export function useScrollTriggerRouteRefresh(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timers = [
      window.setTimeout(() => ScrollTrigger.refresh(), 60),
      window.setTimeout(() => ScrollTrigger.refresh(), 300),
    ];
    window.scrollTo({ top: 0, behavior: "auto" });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pathname]);
}

/**
 * Reduce/replace effects on small screens and for reduced-motion users.
 *
 * Wraps `gsap.matchMedia()` so each breakpoint gets its own timeline and every
 * branch is torn down correctly on revert.
 */
export function useGsapMatchMedia<T extends HTMLElement = HTMLDivElement>(
  builder: (mm: gsap.MatchMedia) => void,
  options: { scope?: React.RefObject<T>; disabled?: boolean; deps?: unknown[] } = {},
): React.RefObject<T> {
  const { scope, disabled = false, deps = [] } = options;
  const innerRef = useRef<T>(null);
  const scopeRef = scope ?? innerRef;
  const pathname = usePathname();
  const builderRef = useRef(builder);
  builderRef.current = builder;

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;
    const element = scopeRef.current;
    if (!element) return;

    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      builderRef.current(mm);
      return () => mm.revert();
    }, element);

    return () => context.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, pathname, scopeRef, ...deps]);

  return scopeRef;
}

export { gsap, ScrollTrigger, SplitText };
