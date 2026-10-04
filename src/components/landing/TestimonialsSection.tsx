"use client";

import { Star } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "@/lib/gsap-config";
import { SectionHeading } from "@/components/ui/primitives";

const TESTIMONIALS = [
  {
    quote:
      "I applied to 40 jobs with a generic resume and heard nothing. ResumeAI showed me I was missing half the JD's actual keywords. Rewrote two sections, landed 3 callbacks in two weeks.",
    name: "Maya R.",
    role: "Product Designer → Fintech",
    initials: "MR",
    tone: "from-indigo-500 to-cyan-400",
  },
  {
    quote:
      "The partial-match feature is brilliant — it caught that I wrote “React.js” while the JD said “React”, and that my “data analysis” didn't match their “data analytics”. No ATS parser gives you that nuance.",
    name: "Daniel K.",
    role: "Data Analyst → Healthcare",
    initials: "DK",
    tone: "from-fuchsia-500 to-indigo-400",
  },
  {
    quote:
      "As a career coach, I run every client resume through it before submission. The section-by-section scores and ATS format check have become my go/no-go checklist.",
    name: "Priya S.",
    role: "Career Coach, 8 yrs",
    initials: "PS",
    tone: "from-emerald-500 to-cyan-400",
  },
];

export default function TestimonialsSection() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    const el = scope.current!;
    const wrap = el.querySelector<HTMLElement>(".tst-wrap")!;
    const stage = el.querySelector<HTMLElement>(".tst-stage")!;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".tst-card"));

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      wrap.style.height = "300vh";
      stage.classList.add(
        "sticky", "top-0", "h-screen", "flex", "items-center", "justify-center", "overflow-hidden",
      );
      cards.forEach((c) => {
        c.classList.add("absolute", "inset-x-0", "mx-auto");
      });

      gsap.set(cards[0], { zIndex: 30 });
      gsap.set(cards[1], { zIndex: 20, scale: 0.93, y: 42, opacity: 0.85 });
      gsap.set(cards[2], { zIndex: 10, scale: 0.87, y: 84, opacity: 0.6 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
      });

      tl.to(cards[0], { yPercent: -125, rotation: 7, opacity: 0, ease: "power2.in", duration: 1 })
        .to(cards[1], { scale: 1, y: 0, opacity: 1, ease: "power2.out", duration: 1 }, "<")
        .to(cards[2], { scale: 0.93, y: 42, opacity: 0.85, ease: "power2.out", duration: 1 }, "<")
        .to({}, { duration: 0.25 })
        .to(cards[1], { yPercent: -125, rotation: -7, opacity: 0, ease: "power2.in", duration: 1 })
        .to(cards[2], { scale: 1, y: 0, opacity: 1, ease: "power2.out", duration: 1 }, "<")
        .to({}, { duration: 0.3 });

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        wrap.style.height = "";
        stage.classList.remove(
          "sticky", "top-0", "h-screen", "flex", "items-center", "justify-center", "overflow-hidden",
        );
        cards.forEach((c) => {
          c.classList.remove("absolute", "inset-x-0", "mx-auto");
          gsap.set(c, { clearProps: "all" });
        });
      };
    });

    mm.add("(max-width: 767px)", () => {
      cards.forEach((c, i) => {
        gsap.from(c, {
          y: 60,
          opacity: 0,
          duration: 0.85,
          delay: i * 0.05,
          ease: "power3.out",
          scrollTrigger: { trigger: c, start: "top 88%", once: true },
        });
      });
    });
  }, []);

  return (
    <section ref={scope} className="relative py-24 sm:py-32">
      <SectionHeading
        kicker="Social proof"
        title={
          <>
            Resumes that <span className="gradient-text">got through.</span>
          </>
        }
        description="Real outcomes from people who stopped guessing what the ATS wanted."
      />

      <div className="tst-wrap relative mx-auto mt-6 max-w-7xl px-5 sm:px-8">
        <div className="tst-stage relative">
          <div className="relative flex w-full flex-col items-center gap-8 md:block md:h-[420px]">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="tst-card glass w-full max-w-2xl rounded-3xl p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] sm:p-10"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <blockquote className="mt-5 text-base leading-relaxed text-ink/90 sm:text-lg">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3.5">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${t.tone} font-display text-sm font-bold text-white`}
                  >
                    {t.initials}
                  </span>
                  <span>
                    <span className="block font-display text-sm font-semibold">{t.name}</span>
                    <span className="block text-xs text-mist">{t.role}</span>
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
