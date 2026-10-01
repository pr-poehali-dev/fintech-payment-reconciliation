import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import functionUrls from '../../backend/func2url.json';
import { DEFAULT_TRIAL_DAYS } from '@/lib/trialDays';
import type { Tariff } from '@/components/landing/PricingSection';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import PricingSection from '@/components/landing/PricingSection';
import CtaSection from '@/components/landing/CtaSection';
import LandingFooter from '@/components/landing/LandingFooter';

const Landing = () => {
  const navigate = useNavigate();
  const [tariffs, setTariffs] = useState<Tariff[] | null>(null);

  // Тарифы и срок пробного периода - из настроек тарифов в админке.
  useEffect(() => {
    fetch(functionUrls['tariffs-list'])
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.tariffs?.length) setTariffs(data.tariffs);
      })
      .catch(() => {});
  }, []);

  const trialDays = tariffs?.find((t) => t.slug === 'trial')?.period_days || DEFAULT_TRIAL_DAYS;

  const handleCtaClick = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader onCtaClick={handleCtaClick} trialDays={trialDays} />
      <HeroSection onCtaClick={handleCtaClick} trialDays={trialDays} />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection onCtaClick={handleCtaClick} trialDays={trialDays} tariffs={tariffs} />
      <CtaSection onCtaClick={handleCtaClick} trialDays={trialDays} />
      <LandingFooter />
    </div>
  );
};

export default Landing;
