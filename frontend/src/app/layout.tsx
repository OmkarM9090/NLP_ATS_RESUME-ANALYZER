import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollProgress from "@/components/layout/ScrollProgress";

export const metadata: Metadata = {
  title: {
    default: "ResumeAI — See your resume the way an ATS does",
    template: "%s · ResumeAI",
  },
  description:
    "Upload a resume and a job description to get a five-signal match score, exact skill gaps, an ATS formatting audit and prioritised fixes — produced by a transparent, inspectable NLP pipeline.",
  keywords: [
    "ATS",
    "resume analyzer",
    "resume matcher",
    "job description match",
    "NLP",
    "keyword analysis",
    "skill gap analysis",
  ],
  applicationName: "ResumeAI",
  authors: [{ name: "ResumeAI" }],
  openGraph: {
    title: "ResumeAI — See your resume the way an ATS does",
    description:
      "A five-signal ATS match score, skill-gap grid, section breakdown and prioritised fixes — from a real NLP pipeline, in about a second.",
    type: "website",
    siteName: "ResumeAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeAI — ATS resume analysis",
    description:
      "Five weighted scoring signals, exact missing keywords, and fixes that actually raise your match score.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0f" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * Resolves the theme before first paint: an explicit choice from a previous
 * visit wins, otherwise the OS preference decides. Kept inline (and tiny) so
 * the page never flashes the wrong mode.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("resumeai:theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="relative min-h-screen bg-night font-sans text-ink antialiased">
        {/* ambient page backdrop — two very low-contrast washes, no more */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night"
        >
          <div className="absolute inset-0 grid-lines opacity-70 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
          <div className="absolute -left-[16%] top-[-14%] h-[560px] w-[560px] rounded-full bg-glow-primary blur-[190px]" />
          <div className="absolute right-[-12%] top-[30%] h-[480px] w-[480px] rounded-full bg-glow-secondary blur-[200px]" />
        </div>

        <ScrollProgress />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-panel2 focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>

        <Navbar />
        <div id="main">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
