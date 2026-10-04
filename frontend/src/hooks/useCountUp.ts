"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export interface CountUpOptions {
  /** Final value. */
  to: number;
  from?: number;
  /** Seconds (default 1.6). */
  duration?: number;
  /** Start only when the element scrolls into view. */
  trigger?: React.RefObject<HTMLElement | null> | null;
  /** Decimals to keep while animating. */
  decimals?: number;
  /** Skip animation entirely (reduced motion). */
  disabled?: boolean;
  ease?: string;
}

/**
 * Animated numeric counter used by the Stats section and the score gauge.
 *
 * Returns the current value plus a formatted string; the animation is driven by
 * a GSAP tween so it shares the site's easing vocabulary and is cancelled on
 * unmount.
 */
export function useCountUp(options: CountUpOptions): {
  value: number;
  display: string;
  isComplete: boolean;
} {
  const {
    to,
    from = 0,
    duration = 1.6,
    trigger = null,
    decimals = 0,
    disabled = false,
    ease = "power2.out",
  } = options;

  const [value, setValue] = useState(disabled ? to : from);
  const [isComplete, setIsComplete] = useState(disabled);
  const proxy = useRef({ current: from });
  const tween = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (disabled) {
      setValue(to);
      setIsComplete(true);
      return;
    }

    proxy.current = { current: from };

    const start = () => {
      tween.current?.kill();
      tween.current = gsap.to(proxy.current, {
        current: to,
        duration,
        ease,
        onUpdate: () => setValue(proxy.current.current),
        onComplete: () => setIsComplete(true),
      });
    };

    const element = trigger?.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      start();
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            start();
            observer.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(element);
      return () => {
        observer.disconnect();
        tween.current?.kill();
      };
    }

    return () => {
      tween.current?.kill();
    };
  }, [to, from, duration, decimals, disabled, ease, trigger]);

  return {
    value,
    display: value.toFixed(decimals),
    isComplete,
  };
}
