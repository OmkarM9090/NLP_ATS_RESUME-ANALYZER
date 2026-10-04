"use client";

import { useLayoutEffect, useRef, type DependencyList } from "react";
import { gsap } from "@/lib/gsap-config";

/**
 * useGSAP — runs a GSAP setup function inside gsap.context() scoped to a
 * container ref, with automatic cleanup (context.revert()) on unmount.
 */
export function useGSAP<T extends HTMLElement = HTMLDivElement>(
  callback: (ctx: { scope: React.RefObject<T | null> }) => void,
  deps: DependencyList = [],
) {
  const scope = useRef<T>(null);

  useLayoutEffect(() => {
    if (!scope.current) return;
    const ctx = gsap.context(() => callback({ scope }), scope.current);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scope;
}
