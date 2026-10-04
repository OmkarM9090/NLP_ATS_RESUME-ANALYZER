"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, PlayCircle } from "lucide-react";
import { gsap, splitText } from "@/lib/anim";
import { prefersReducedMotion } from "@/lib/gsap-config";
import { LinkButton } from "@/components/ui/primitives";

export default function CTASection() {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const lines = el.querySelectorAll<HTMLElement>(".cta-line");
      const units: HTMLElement[] = [];
      lines.forEach((line) => units.push(...splitText(line, "words")));

      const tl = gsap.timeline({
        defaults: { ease: "power4.out" },
        scrollTrigger: { trigger: el, start: "top 68%", once: true },
      });

      if (units.length) {
        tl.fromTo(
          units,
          { yPercent: 115, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 1, stagger: 0.035 },
        );
      }
      tl.fromTo(
        el.querySelector(".cta-sub"),
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8 },
        "-=0.6",
      )
        .fromTo(
          el.querySelectorAll(".cta-cta"),
          { y: 20, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.08 },
          "-=0.55",
        )
        .fromTo(
          el.querySelector(".cta-note"),
          { opacity: 0 },
          { opacity: 1, duration: 0.6 },
          "-=0.4",
        );

      gsap.to(el.querySelector(".cta-glow"), {
        yPercent: -22,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} className="relative overflow-hidden py-28 sm:py-36">
      <div className="cta-glow pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(110,86,248,0.22),transparent_65%)] blur-[40px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <p className="eyebrow justify-center">
          <span className="h-1 w-1 rounded-full bg-secondary" />
          ready when you are
        </p>

        <h2 className="display-2 mt-6">
          <span className="block overflow-hidden pb-[0.06em]">
            <span className="cta-line block">Stop applying blind.</span>
          </span>
          <span className="block overflow-hidden pb-[0.1em]">
            <span className="cta-line block text-gradient">See the score first.</span>
          </span>
        </h2>

        <p className="cta-sub lede mx-auto mt-6 max-w-xl">
          Upload a resume and a job description — you&apos;ll have a weighted
          match score, the missing keywords and a prioritised fix list in about
          a second.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/analyze" size="lg" magnetic className="cta-cta group">
            Analyze my resume
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </LinkButton>
          <LinkButton
            href="/analyze?sample=1"
            variant="secondary"
            size="lg"
            className="cta-cta"
          >
            <PlayCircle className="h-4 w-4 text-secondary" strokeWidth={2.1} />
            Try the sample pair
          </LinkButton>
        </div>

        <p className="cta-note mt-7 font-mono text-[10.5px] uppercase tracking-[0.24em] text-faint">
          no account · files never leave your session
        </p>
      </div>
    </section>
  );
}
