import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  const { hash } = useLocation();

  // Переход по ссылке вида /#pricing (например, «Сменить тариф») - прокручиваем к блоку.
  useEffect(() => {
    if (!hash) return;
    const timer = setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
    return () => clearTimeout(timer);
  }, [hash, tariffs]);

  const trialTariff = tariffs?.find((t) => t.slug === 'trial');
  const trialDays = trialTariff?.trial_days || trialTariff?.period_days || DEFAULT_TRIAL_DAYS;

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
