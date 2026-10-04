"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";

import { useGsapContext } from "@/hooks/useGsapContext";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { IconGithub, IconSpark } from "@/components/ui/Icons";
import { APP_NAME, APP_VERSION, FOOTER_LINKS } from "@/lib/constants";

/** Footer with a staggered link reveal as it scrolls into view. */
export function Footer() {
  const scopeRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const year = new Date().getFullYear();

  useGsapContext(
    () => {
      gsap.fromTo(
        "[data-footer-col]",
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.07,
          scrollTrigger: { trigger: scopeRef.current, start: "top 92%", toggleActions: "play none none reverse" },
        },
      );
      gsap.fromTo(
        "[data-footer-link]",
        { opacity: 0, x: -10 },
        {
          opacity: 1,
          x: 0,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.035,
          scrollTrigger: { trigger: scopeRef.current, start: "top 88%", toggleActions: "play none none reverse" },
        },
      );
    },
    { scope: scopeRef, disabled: reducedMotion },
  );

  return (
    <footer ref={scopeRef} className="no-print relative border-t border-line bg-bg-deep/60">
      <div className="section-inner py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <div data-footer-col className="space-y-5">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-button bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
                <IconSpark size={18} />
              </span>
              <span className="font-heading text-h5 tracking-tight">
                ATS<span className="text-primary-300">·</span>Matcher
              </span>
            </Link>

            <p className="max-w-sm text-small leading-relaxed text-ink-muted">
              An NLP-powered resume ↔ job-description compatibility analyser. FastAPI, spaCy,
              sentence-transformers and scikit-learn behind a Next.js interface.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-button border border-line px-3 py-2 font-mono text-micro uppercase tracking-[0.14em] text-ink-muted transition-colors hover:border-primary-400/50 hover:text-ink"
              >
                <IconGithub size={15} />
                Source
              </a>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-button border border-line px-3 py-2 font-mono text-micro uppercase tracking-[0.14em] text-ink-muted transition-colors hover:border-secondary-400/50 hover:text-ink"
              >
                API docs
              </Link>
              <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-faint">
                v{APP_VERSION}
              </span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_LINKS.map((group) => (
              <div key={group.title} data-footer-col className="space-y-4">
                <p className="label">{group.title}</p>
                <ul className="space-y-2.5">
                  {group.links.map((link) => {
                    const external = link.href.startsWith("http") || link.href.startsWith("mailto:");
                    const className =
                      "inline-block text-small text-ink-muted transition-colors hover:text-ink";
                    return (
                      <li key={link.label} data-footer-link>
                        {external ? (
                          <a
                            href={link.href}
                            className={className}
                            target={link.href.startsWith("http") ? "_blank" : undefined}
                            rel={link.href.startsWith("http") ? "noreferrer noopener" : undefined}
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link href={link.href} className={className}>
                            {link.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-ink-faint">
            © {year} {APP_NAME}. MIT licensed.
          </p>
          <p className="font-mono text-micro uppercase tracking-[0.16em] text-ink-faint">
            Documents are processed locally — never sent to a third party
          </p>
        </div>
      </div>
    </footer>
  );
}
