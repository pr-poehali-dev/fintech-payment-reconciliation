import { useNavigate } from 'react-router-dom';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import PricingSection from '@/components/landing/PricingSection';
import CtaSection from '@/components/landing/CtaSection';
import LandingFooter from '@/components/landing/LandingFooter';

const Landing = () => {
  const navigate = useNavigate();

  const handleCtaClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader onCtaClick={handleCtaClick} />
      <HeroSection onCtaClick={handleCtaClick} />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection onCtaClick={handleCtaClick} />
      <CtaSection onCtaClick={handleCtaClick} />
      <LandingFooter />
    </div>
  );
};

export default Landing;
