import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * Single entry point for GSAP across the app.
 *
 * Plugins are registered once, client-side only, so no component ever has to
 * worry about registration order. Only the two plugins the UI actually uses are
 * pulled in — everything else is hand-rolled with core tweens to keep the
 * client bundle lean.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);

  gsap.defaults({ ease: "power3.out", duration: 0.9 });
  ScrollTrigger.config({ ignoreMobileResize: true });
  ScrollTrigger.defaults({ markers: false });
}

export { gsap, ScrollTrigger, SplitText };

/** True when the visitor asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
