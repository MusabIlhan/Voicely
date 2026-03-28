import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import LogoBar from "@/components/LogoBar";
import FeaturesGrid from "@/components/FeaturesGrid";
import HowItWorks from "@/components/HowItWorks";
import UseCases from "@/components/UseCases";
import Integrations from "@/components/Integrations";
import Testimonials from "@/components/Testimonials";
import PricingSection from "@/components/PricingSection";
import TrustBar from "@/components/TrustBar";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
    <Navbar />
    <HeroSection />
    <LogoBar />
    <FeaturesGrid />
    <HowItWorks />
    <UseCases />
    <Integrations />
    <Testimonials />
    <PricingSection />
    <TrustBar />
    <Footer />
  </div>
);

export default Index;
