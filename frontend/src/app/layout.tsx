import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/layout/AppShell";
import { APP_NAME } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: `${APP_NAME} — NLP-powered ATS resume analysis`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Upload a resume and a job description to get an ATS match score from a twelve-stage NLP pipeline: keyword coverage, semantic similarity, skill gaps, section scoring and formatting checks.",
  keywords: [
    "ATS",
    "resume matcher",
    "resume analyzer",
    "NLP",
    "spaCy",
    "sentence-transformers",
    "job description",
    "keyword matching",
    "skill gap analysis",
  ],
  authors: [{ name: "Omkar M" }],
  openGraph: {
    title: `${APP_NAME} — NLP-powered ATS resume analysis`,
    description:
      "Twelve-stage NLP pipeline that scores a resume against a job description and explains every point.",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME}`,
    description: "Know exactly why an ATS rejected your resume.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
