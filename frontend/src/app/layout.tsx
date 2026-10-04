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
  themeColor: "#0a0c11",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen bg-night font-sans text-ink antialiased">
        {/* ambient page backdrop — kept extremely subtle, sits under everything */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night"
        >
          <div className="absolute inset-0 grid-lines opacity-60 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
          <div className="absolute -left-[18%] top-[-12%] h-[620px] w-[620px] rounded-full bg-primary/[0.13] blur-[190px]" />
          <div className="absolute right-[-14%] top-[28%] h-[520px] w-[520px] rounded-full bg-secondary/[0.07] blur-[200px]" />
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
