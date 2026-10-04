import type { Metadata } from "next";

import { Preloader } from "@/components/landing/Preloader";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Stats } from "@/components/landing/Stats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "NLP-powered ATS resume analysis",
  description:
    "Score a resume against a job description with a twelve-stage NLP pipeline: keyword coverage, semantic similarity, skill gaps, ATS formatting and prioritised fixes.",
};

/**
 * Landing page. Each section owns its GSAP timeline through `useGsapContext`,
 * which guarantees `context.revert()` on unmount and a ScrollTrigger refresh
 * after navigation.
 */
export default function LandingPage() {
  return (
    <>
      <Preloader />
      <Hero />
      <Features />
      <Stats />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
