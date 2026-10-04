"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, ScanText, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "History", href: "/history" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500",
          scrolled
            ? "glass-strong border-b border-line/60"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-7xl items-center justify-between px-5 transition-all duration-500 sm:px-8",
            scrolled ? "h-16" : "h-20",
          )}
        >
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="gradient-1 flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_4px_16px_-4px_rgba(99,102,241,0.6)] transition-transform duration-300 group-hover:rotate-6">
              <ScanText className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Resume<span className="gradient-text">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className={cn(
                  "text-sm font-medium transition-colors duration-300 hover:text-ink",
                  pathname === l.href ? "text-ink" : "text-mist",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:block">
            <Link
              href="/analyze"
              className="gradient-1 inline-flex h-10 items-center gap-2 rounded-xl px-5 font-display text-sm font-semibold text-white shadow-[0_6px_24px_-6px_rgba(99,102,241,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_-6px_rgba(99,102,241,0.75)]"
            >
              <Sparkles className="h-4 w-4" />
              Analyze Now
            </Link>
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex flex-col bg-night/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex h-20 items-center justify-between px-5">
              <span className="font-display text-lg font-bold">
                Resume<span className="gradient-text">AI</span>
              </span>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col items-center justify-center gap-8">
              {[...NAV_LINKS, { label: "Analyze Now", href: "/analyze" }].map(
                (l, i) => (
                  <motion.div
                    key={l.label}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.07, duration: 0.5 }}
                  >
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="font-display text-3xl font-semibold text-ink transition-colors hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  </motion.div>
                ),
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
