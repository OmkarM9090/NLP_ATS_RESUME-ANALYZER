import Preloader from "@/components/landing/Preloader";
import HeroSection from "@/components/landing/HeroSection";
import LogoMarquee from "@/components/landing/LogoMarquee";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import StatsSection from "@/components/landing/StatsSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <main className="relative noise-overlay">
      <Preloader />
      <HeroSection />
      <LogoMarquee />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  );
}
