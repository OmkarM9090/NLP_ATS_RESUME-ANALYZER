"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, ScanText, Sparkles, X } from "lucide-react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap-config";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";

const REPO_URL = "https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pipeline", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "History", href: "/history" },
];

/* -------------------------------------------------------------------------- */

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelLinksRef = useRef<HTMLDivElement>(null);

  /* ------------------------- condensed-on-scroll shell ------------------- */
  useEffect(() => {
    const shell = shellRef.current;
    const glass = glassRef.current;
    if (!shell || !glass) return;

    const st = ScrollTrigger.create({
      start: "top -24px",
      end: "max",
      onUpdate: (self) => {
        const on = self.progress > 0 || window.scrollY > 24;
        gsap.to(glass, {
          autoAlpha: on ? 1 : 0,
          duration: 0.45,
          ease: "power2.out",
          overwrite: true,
        });
        if (!prefersReducedMotion()) {
          gsap.to(shell, {
            paddingTop: on ? 10 : 6,
            paddingBottom: on ? 10 : 6,
            duration: 0.45,
            ease: "power3.out",
            overwrite: true,
          });
        }
      },
    });
    return () => st.kill();
  }, []);

  /* --------------------------- sliding indicator ------------------------- */
  const moveIndicator = (target: HTMLElement | null) => {
    const indicator = indicatorRef.current;
    const wrap = linksRef.current;
    if (!indicator || !wrap) return;
    if (!target) {
      gsap.to(indicator, { autoAlpha: 0, duration: 0.25 });
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    gsap.to(indicator, {
      autoAlpha: 1,
      x: rect.left - wrapRect.left,
      width: rect.width,
      duration: 0.42,
      ease: "power3.out",
    });
  };

  useEffect(() => {
    const wrap = linksRef.current;
    if (!wrap) return;
    const active =
      wrap.querySelector<HTMLElement>("[data-nav-active='true']") ??
      wrap.querySelector<HTMLElement>("a,button");
    moveIndicator(active);
  }, [pathname]);

  /* ------------------------------ mobile panel -------------------------- */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (open) {
      document.documentElement.style.overflow = "hidden";
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      tl.set(panel, { display: "flex" })
        .fromTo(
          panel,
          { clipPath: "inset(0 0 100% 0)", opacity: 0.6 },
          { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 0.72 },
        )
        .fromTo(
          panelLinksRef.current?.children ?? [],
          { y: 34, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, stagger: 0.06 },
          "-=0.42",
        );
      return () => {
        tl.kill();
        document.documentElement.style.overflow = "";
      };
    }
    const close = gsap.timeline({
      onComplete: () => gsap.set(panel, { display: "none" }),
    });
    close.to(panel, {
      clipPath: "inset(0 0 100% 0)",
      opacity: 0.4,
      duration: 0.42,
      ease: "power3.inOut",
    });
    return () => {
      close.kill();
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 sm:px-5">
        <div
          ref={shellRef}
          className="pointer-events-auto nav-frame relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-2xl px-4 py-1.5 sm:px-5"
        >
          {/* glossy backdrop layer */}
          <div
            ref={glassRef}
            className="nav-shell absolute inset-0 -z-10 rounded-2xl opacity-0"
            aria-hidden
          />

          {/* brand */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="ResumeAI home"
          >
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-b from-primary to-primary-2 shadow-[0_1px_2px_rgba(9,9,11,0.16),inset_0_1px_0_rgba(255,255,255,0.22)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-6">
              <ScanText className="h-[18px] w-[18px] text-white" strokeWidth={2.3} />
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/50" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-bold tracking-[-0.03em]">
                Resume<span className="text-gradient-mint">AI</span>
              </span>
              <span className="mt-0.5 hidden font-mono text-[8.5px] uppercase tracking-[0.24em] text-faint sm:block">
                ats intelligence
              </span>
            </span>
          </Link>

          {/* desktop links with sliding indicator */}
          <nav
            ref={linksRef}
            onMouseLeave={() => moveIndicator(null)}
            className="relative hidden items-center gap-0.5 md:flex"
          >
            <span
              ref={indicatorRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-tint-3 opacity-0 ring-1 ring-line-soft"
              style={{ width: 0 }}
            />
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href.startsWith("/#") === false && pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  data-nav-active={isActive}
                  onMouseEnter={(e) => moveIndicator(e.currentTarget)}
                  className={cn(
                    "relative z-10 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-300",
                    isActive ? "text-ink" : "text-mist hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* actions */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />

            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="View the source on GitHub"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-mist transition-colors duration-300 hover:bg-tint-3 hover:text-ink lg:flex"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.35.77 1.05.77 2.12v3.15c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
            </a>

            <Link
              href="/analyze"
              className="btn btn-primary group hidden h-9 px-4 text-[13.5px] sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
              Analyze my resume
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={open}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-tint-3 md:hidden"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* mobile panel */}
      <div
        ref={panelRef}
        style={{ display: "none" }}
        className="fixed inset-0 z-[60] hidden flex-col bg-void/95 backdrop-blur-2xl md:!hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-[17px] font-bold tracking-[-0.03em]">
            Resume<span className="text-gradient-mint">AI</span>
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle className="h-10 w-10" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-tint-3"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div ref={panelLinksRef} className="flex flex-1 flex-col justify-center gap-1 px-5">
          {[...NAV_LINKS, { label: "Analyze my resume", href: "/analyze" }].map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-between border-b border-line-soft py-5 font-display text-[26px] font-semibold tracking-[-0.03em] transition-colors",
                i === NAV_LINKS.length ? "text-secondary" : "text-ink hover:text-primary-2",
              )}
            >
              {link.label}
              <ArrowUpRight className="h-5 w-5 opacity-40" />
            </Link>
          ))}
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-faint">
            nlp · tf-idf · semantic · taxonomy
          </p>
        </div>
      </div>
    </>
  );
}
