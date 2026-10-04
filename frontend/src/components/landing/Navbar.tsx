"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { IconClose, IconGithub, IconMenu, IconSpark } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Results", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

/**
 * Sticky navigation: transparent at the top, frosted surface once scrolled.
 *
 * Anchor links resolve against the landing page even when the user is on
 * /analyze or /results, and the mobile drawer is Framer-Motion driven.
 */
export function Navbar({ healthDegraded = false }: { healthDegraded?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const href = (target: string) => (pathname === "/" ? target : `/${target}`);

  return (
    <header
      className={cn(
        "no-print fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav className="container mx-auto flex h-[72px] w-full items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-button py-1.5 pr-3"
          aria-label={`${APP_NAME} home`}
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-button bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-glow">
            <IconSpark size={18} />
          </span>
          <span className="font-heading text-h5 leading-none tracking-tight">
            ATS<span className="text-primary-300">·</span>Matcher
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={href(link.href)}
              className="rounded-button px-3.5 py-2 text-small text-ink-muted transition-colors hover:bg-surface-raised/70 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {healthDegraded ? (
            <span className="hidden items-center gap-1.5 rounded-pill border border-warning/35 bg-warning/10 px-2.5 py-1 font-mono text-micro uppercase tracking-[0.12em] text-warning md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              degraded
            </span>
          ) : null}

          <a
            href="https://github.com/OmkarM9090/NLP_ATS_RESUME-ANALYZER"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden h-10 w-10 place-items-center rounded-button border border-line text-ink-muted transition-colors hover:border-primary-400/50 hover:text-ink sm:grid"
            aria-label="Source on GitHub"
          >
            <IconGithub size={18} />
          </a>

          <Button href="/analyze" size="sm" className="hidden sm:inline-flex">
            Analyse resume
          </Button>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-button border border-line text-ink-muted transition-colors hover:text-ink lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <IconClose size={18} /> : <IconMenu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
          >
            <div className="container mx-auto flex flex-col gap-1 px-5 py-4 sm:px-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={href(link.href)}
                  className="rounded-button px-3 py-3 text-body text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
              <Button href="/analyze" size="md" fullWidth className="mt-2">
                Analyse a resume
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
