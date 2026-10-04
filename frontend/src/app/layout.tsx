import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: {
    default: "ResumeAI — ATS Resume Matcher",
    template: "%s · ResumeAI",
  },
  description:
    "NLP-powered ATS resume analysis. Upload your resume and a job description to get a multi-dimensional match score, skill gap analysis, and actionable recommendations in seconds.",
  keywords: [
    "ATS",
    "resume",
    "job description",
    "NLP",
    "resume matcher",
    "keyword analysis",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-night font-sans text-ink antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
