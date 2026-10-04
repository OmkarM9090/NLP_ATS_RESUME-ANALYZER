"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe `matchMedia` subscription.
 *
 * Returns `false` during server rendering and the first client paint, then
 * tracks the query. Used to gate heavy animation on small screens.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    // Safari <14 only supports addListener.
    if (typeof list.addEventListener === "function") {
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    }
    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, [query]);

  return matches;
}

/** True on phones/small tablets — where pinned scroll effects are reduced. */
export function useIsMobile(breakpointPx = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpointPx - 1}px)`);
}

/** Respects the OS-level "reduce motion" accessibility setting. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
