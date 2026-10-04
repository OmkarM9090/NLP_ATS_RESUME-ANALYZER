"use client";

import { useGSAP } from "@/hooks/useGSAP";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";

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
  const ref = useGSAP<HTMLSpanElement>(({ scope }) => {
    const el = scope.current;
    if (!el) return;
    const obj = { val: 0 };
    const render = () => {
      const v = obj.val.toFixed(decimals);
      el.textContent =
        prefix + (format ? Number(v).toLocaleString("en-US") : v) + suffix;
    };
    render();

    const tween = gsap.to(obj, {
      val: value,
      duration,
      ease: "power2.out",
      onUpdate: render,
      paused: true,
    });

    if (startOnView) {
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        once: true,
        onEnter: () => tween.play(),
      });
    } else {
      tween.play();
    }
  }, [value, decimals, suffix, prefix, duration, startOnView]);

  return <span ref={ref} className={cn("tabular-nums", className)} />;
}
