import type { Metadata } from "next";
import Preloader from "@/components/landing/Preloader";
import HeroSection from "@/components/landing/HeroSection";
import PipelineTicker from "@/components/landing/PipelineTicker";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import StatsSection from "@/components/landing/StatsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";

export const metadata: Metadata = {
  title: "ResumeAI — See your resume the way an ATS does",
};

export default function Home() {
  return (
    <main className="relative">
      <Preloader />
      <HeroSection />
      <PipelineTicker />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
    </main>
  );
}
