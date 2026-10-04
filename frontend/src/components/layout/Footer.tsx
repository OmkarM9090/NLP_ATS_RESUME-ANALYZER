"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mail, ScanText } from "lucide-react";
import { gsap, revealOnScroll } from "@/lib/anim";
import { healthCheck } from "@/lib/api";

const REPO_URL = "https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER";

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

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Analyze a resume", href: "/analyze" },
      { label: "Run sample analysis", href: "/analyze?sample=1" },
      { label: "Analysis history", href: "/history" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Engine",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Scoring signals", href: "/#features" },
      { label: "API reference", href: "http://127.0.0.1:8000/docs" },
      { label: "Service health", href: "/api/health" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Source code", href: REPO_URL },
      { label: "README", href: `${REPO_URL}#readme` },
      { label: "Report an issue", href: `${REPO_URL}/issues` },
      { label: "License (MIT)", href: `${REPO_URL}/blob/main/LICENSE` },
    ],
  },
];

const SOCIALS = [
  { icon: GithubIcon, href: REPO_URL, label: "GitHub" },
  { icon: XIcon, href: "https://x.com", label: "X (Twitter)" },
  { icon: LinkedInIcon, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: Mail, href: "mailto:hello@resumeai.dev", label: "Email" },
];

export default function Footer() {
  const scope = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;
    healthCheck()
      .then((h) => !cancelled && setStatus(h.status === "ok" ? "online" : "offline"))
      .catch(() => !cancelled && setStatus("offline"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      revealOnScroll(el.querySelectorAll("[data-footer-col]"), {
        trigger: el,
        y: 26,
        stagger: 0.07,
        start: "top 92%",
      });
      const line = el.querySelector(".footer-rule");
      if (line) {
        gsap.fromTo(
          line,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: "left center",
            duration: 1.5,
            ease: "power3.inOut",
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          },
        );
      }
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={scope} className="relative overflow-hidden border-t border-line-soft">
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-80 ambient-bottom" />
      <div className="footer-rule absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div data-footer-col className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5" aria-label="ResumeAI home">
              <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-b from-primary to-primary-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                <ScanText className="h-[18px] w-[18px] text-white" strokeWidth={2.3} />
              </span>
              <span className="font-display text-[17px] font-bold tracking-[-0.03em]">
                Resume<span className="text-gradient-mint">AI</span>
              </span>
            </Link>
            <p className="mt-5 max-w-xs text-[13.5px] leading-relaxed text-mist">
              A transparent ATS resume analyzer. Upload a resume and a job
              description to see the five weighted signals, the exact skill
              gaps, and the fixes that move your score.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-tint-1 text-mist ring-1 ring-line-soft transition-all duration-300 hover:-translate-y-0.5 hover:text-ink hover:ring-line-strong"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            <div className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-tint-1 px-3 py-1.5 ring-1 ring-line-soft">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={
                    status === "online"
                      ? "absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70"
                      : "hidden"
                  }
                />
                <span
                  className={
                    "relative inline-flex h-1.5 w-1.5 rounded-full " +
                    (status === "online"
                      ? "bg-success"
                      : status === "offline"
                        ? "bg-warning"
                        : "bg-faint")
                  }
                />
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-mist">
                {status === "online"
                  ? "nlp api online"
                  : status === "offline"
                    ? "api unreachable"
                    : "checking api"}
              </span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} data-footer-col>
              <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-faint">
                {col.title}
              </h4>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => {
                  const external = l.href.startsWith("http");
                  return (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                        className="group inline-flex items-center text-[13.5px] text-mist transition-colors duration-200 hover:text-ink"
                      >
                        <span className="mr-0 h-px w-0 bg-primary-2 transition-all duration-300 group-hover:mr-2 group-hover:w-3" />
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line-soft pt-6 sm:flex-row">
          <p className="text-[12.5px] text-faint">
            © {new Date().getFullYear()} ResumeAI · Resumes are analyzed in request
            scope and never shared.
          </p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">
            tf-idf · rake · semantic · taxonomy · ner
          </p>
        </div>
      </div>
    </footer>
  );
}
