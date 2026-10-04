"use client";

import { ArrowRight } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { LinkButton } from "@/components/ui/primitives";

export default function CTASection() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    const el = scope.current!;

    gsap.fromTo(
      el.querySelector(".cta-bg"),
      { opacity: 0 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          end: "top 25%",
          scrub: true,
        } satisfies ScrollTrigger.Vars,
      },
    );

    gsap.from(el.querySelectorAll(".cta-line-inner"), {
      yPercent: 115,
      stagger: 0.12,
      duration: 1,
      ease: "power4.out",
      scrollTrigger: { trigger: el, start: "top 70%", once: true },
    });

    gsap.from(el.querySelector(".cta-actions"), {
      scale: 0.9,
      opacity: 0,
      duration: 0.8,
      ease: "back.out(1.7)",
      scrollTrigger: { trigger: el, start: "top 55%", once: true },
    });
  }, []);

  return (
    <section ref={scope} className="relative overflow-hidden py-28 sm:py-36">
      <div className="cta-bg gradient-1 absolute inset-0 opacity-0" />
      <div className="cta-bg absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent,rgba(10,10,15,0.55))]" />
      <div className="noise-overlay absolute inset-0" />

      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <h2 className="font-display text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
          <span className="block overflow-hidden pb-1">
            <span className="cta-line-inner block">Ready to stop getting</span>
          </span>
          <span className="block overflow-hidden pb-2">
            <span className="cta-line-inner block">filtered out?</span>
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
          Upload your resume and a job description. Get an honest,
          detailed match analysis in seconds — then fix what matters.
        </p>
        <div className="cta-actions mt-10 flex justify-center">
          <LinkButton
            href="/analyze"
            size="lg"
            magnetic
            className="group bg-night text-ink shadow-2xl hover:bg-night/90"
            variant="secondary"
          >
            <span className="gradient-text font-display">Start free analysis</span>
            <ArrowRight className="h-4 w-4 text-secondary transition-transform duration-300 group-hover:translate-x-1" />
          </LinkButton>
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.3em] text-white/60">
          No account · Files never leave your session
        </p>
      </div>
    </section>
  );
}
