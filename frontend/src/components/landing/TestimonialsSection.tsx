"use client";

import { useEffect, useRef } from "react";
import { Quote, Star } from "lucide-react";
import { gsap } from "@/lib/gsap-config";
import { SectionHeading } from "@/components/ui/primitives";

const TESTIMONIALS = [
  {
    quote:
      "I applied to forty jobs with a generic resume and heard nothing back. ResumeAI showed me I was missing half of the posting's actual keywords. Two sections rewritten, three callbacks in two weeks.",
    name: "Maya R.",
    role: "Product Designer → fintech",
    initials: "MR",
    tone: "from-primary-2 to-primary",
  },
  {
    quote:
      "The partial-match list is the part nobody else gives you. It caught that I wrote “React.js” where the posting said “React”, and that “data analysis” did not match their “data analytics”.",
    name: "Daniel K.",
    role: "Data Analyst → healthcare",
    initials: "DK",
    tone: "from-emerald-500 to-teal-600",
  },
  {
    quote:
      "As a coach I run every client resume through it before submission. The section-by-section scores and the formatting audit became my go/no-go checklist.",
    name: "Priya S.",
    role: "Career coach, 8 years",
    initials: "PS",
    tone: "from-amber-500 to-orange-600",
  },
];

export default function TestimonialsSection() {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const wrap = el.querySelector<HTMLElement>(".tst-wrap");
        const stage = el.querySelector<HTMLElement>(".tst-stage");
        const stack = el.querySelector<HTMLElement>(".tst-stack");
        const cards = gsap.utils.toArray<HTMLElement>(".tst-card", el);
        if (!wrap || !stage || !stack || cards.length < 3) return;

        wrap.style.height = "290vh";
        stage.classList.add("sticky", "top-0", "flex", "h-screen", "items-center");
        cards.forEach((c) => c.classList.add("absolute", "inset-x-0", "mx-auto"));

        gsap.set(cards[0], { zIndex: 30, y: 0, scale: 1, opacity: 1 });
        gsap.set(cards[1], { zIndex: 20, y: 46, scale: 0.945, opacity: 0.55 });
        gsap.set(cards[2], { zIndex: 10, y: 92, scale: 0.89, opacity: 0.3 });

        const tl = gsap.timeline({
          scrollTrigger: { trigger: wrap, start: "top top", end: "bottom bottom", scrub: 0.9 },
        });

        tl.to(cards[0], {
          yPercent: -118,
          rotation: 5,
          opacity: 0,
          ease: "power2.in",
          duration: 1,
        })
          .to(cards[1], { y: 0, scale: 1, opacity: 1, ease: "power2.out", duration: 1 }, "<")
          .to(cards[2], { y: 46, scale: 0.945, opacity: 0.55, ease: "power2.out", duration: 1 }, "<")
          .to({}, { duration: 0.3 })
          .to(cards[1], {
            yPercent: -118,
            rotation: -5,
            opacity: 0,
            ease: "power2.in",
            duration: 1,
          })
          .to(cards[2], { y: 0, scale: 1, opacity: 1, ease: "power2.out", duration: 1 }, "<")
          .to({}, { duration: 0.3 });

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
          wrap.style.height = "";
          stage.classList.remove("sticky", "top-0", "flex", "h-screen", "items-center");
          cards.forEach((c) => {
            c.classList.remove("absolute", "inset-x-0", "mx-auto");
            gsap.set(c, { clearProps: "all" });
          });
        };
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(el.querySelectorAll(".tst-card"), {
          y: 44,
          opacity: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 76%", once: true },
        });
      });

      return () => mm.revert();
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={scope} className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          kicker="outcomes"
          title={
            <>
              Resumes that <span className="text-gradient">got through.</span>
            </>
          }
          description="Three people who stopped guessing what the filter wanted."
        />
      </div>

      <div className="tst-wrap relative mx-auto mt-14 max-w-4xl px-5 sm:px-8">
        <div className="tst-stage relative">
          <div className="tst-stack relative flex flex-col items-center gap-6 md:h-[330px] md:block">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="tst-card card relative w-full max-w-2xl rounded-3xl p-7 shadow-float sm:p-9"
              >
                <Quote
                  className="absolute right-8 top-7 h-8 w-8 text-ink/10"
                  strokeWidth={2}
                />
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                  ))}
                </div>
                <blockquote className="mt-5 text-[15.5px] leading-relaxed text-ink/90 sm:text-[17px]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3.5 border-t border-line-soft pt-5">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.tone} font-display text-[13px] font-bold text-white ring-1 ring-white/15`}
                  >
                    {t.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[14px] font-semibold tracking-[-0.01em]">
                      {t.name}
                    </span>
                    <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                      {t.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
