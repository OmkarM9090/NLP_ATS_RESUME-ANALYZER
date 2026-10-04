"use client";

import Link from "next/link";
import { Mail, ScanText } from "lucide-react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.35.77 1.05.77 2.12v3.15c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.4Z" />
    </svg>
  );
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Analyze a Resume", href: "/analyze" },
      { label: "Try Sample Analysis", href: "/analyze?sample=1" },
      { label: "Analysis History", href: "/history" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How It Works", href: "/#how-it-works" },
      { label: "NLP Features", href: "/#features" },
      { label: "API Health", href: "/api/health" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Notice", href: "/#privacy" },
      { label: "Terms of Use", href: "/#terms" },
      { label: "Data Retention", href: "/#retention" },
    ],
  },
];

const SOCIALS = [
  { icon: GithubIcon, href: "https://github.com", label: "GitHub" },
  { icon: XIcon, href: "https://x.com", label: "X (Twitter)" },
  { icon: LinkedInIcon, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: Mail, href: "mailto:hello@resumeai.dev", label: "Email" },
];

export default function Footer() {
  const scope = useGSAP<HTMLElement>(({ scope }) => {
    const line = scope.current?.querySelector(".footer-line");
    if (line) {
      gsap.fromTo(
        line,
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: "left center",
          duration: 1.4,
          ease: "power3.inOut",
          scrollTrigger: {
            trigger: scope.current,
            start: "top 92%",
            once: true,
          } satisfies ScrollTrigger.Vars,
        },
      );
    }
    const cols = scope.current?.querySelectorAll("[data-footer-col]");
    if (cols?.length) {
      gsap.from(cols, {
        y: 28,
        opacity: 0,
        stagger: 0.08,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: scope.current,
          start: "top 88%",
          once: true,
        } satisfies ScrollTrigger.Vars,
      });
    }
  }, []);

  return (
    <footer ref={scope} className="relative border-t border-line/60 bg-panel">
      <div className="footer-line absolute -top-px left-0 h-px w-full gradient-1" />
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div data-footer-col>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="gradient-1 flex h-9 w-9 items-center justify-center rounded-lg">
                <ScanText className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                Resume<span className="gradient-text">AI</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-mist">
              Multi-dimensional ATS resume analysis powered by a transparent,
              inspectable NLP pipeline — keyword, semantic, skill, experience,
              and education signals combined.
            </p>
            <div className="mt-6 flex gap-3">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-mist transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:text-ink"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title} data-footer-col>
              <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-ink">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-mist transition-colors duration-200 hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line/50 pt-7 sm:flex-row">
          <p className="text-xs text-mist">
            © 2026 ResumeAI. Resumes are analyzed in request scope — nothing is
            shared or sold.
          </p>
          <p className="font-mono text-[11px] text-mist/70">
            pipeline: tf-idf · rake · semantic-coverage · skill-taxonomy · ner
          </p>
        </div>
      </div>
    </footer>
  );
}
