import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import functionUrls from '../../../backend/func2url.json';

interface Tariff {
  slug: string;
  name: string;
  description: string;
  price: number;
  billing_period: string;
  max_companies: number;
  max_users: number;
  max_integrations: number;
  features: string[];
}

const FALLBACK_TARIFFS: Tariff[] = [
  {
    slug: 'trial',
    name: 'Пробный период',
    description: '7 дней бесплатно, все функции доступны',
    price: 0,
    billing_period: 'month',
    max_companies: 1,
    max_users: 3,
    max_integrations: 2,
    features: ['Все модули', 'Email поддержка']
  },
  {
    slug: 'start',
    name: 'Старт',
    description: 'Для небольшого бизнеса с одной компанией',
    price: 990,
    billing_period: 'month',
    max_companies: 1,
    max_users: 5,
    max_integrations: 3,
    features: ['Все модули', 'Приоритетная поддержка']
  },
  {
    slug: 'business',
    name: 'Бизнес',
    description: 'Для бухгалтерий и агентств с несколькими компаниями',
    price: 2990,
    billing_period: 'month',
    max_companies: 5,
    max_users: 20,
    max_integrations: 10,
    features: ['Все модули', 'Автоматизации', 'Приоритетная поддержка']
  }
];

const PricingSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const [tariffs, setTariffs] = useState<Tariff[]>(FALLBACK_TARIFFS);

  useEffect(() => {
    fetch(functionUrls['tariffs-list'])
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.tariffs?.length) {
          setTariffs(data.tariffs);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Простые и понятные тарифы
          </h2>
          <p className="text-lg text-muted-foreground">
            Начните с бесплатного периода, растите — переключайтесь на тариф с бо́льшим числом компаний.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tariffs.map((tariff, index) => {
            const isPopular = tariff.slug === 'start';
            return (
              <Card
                key={tariff.slug}
                className={`relative border-border bg-card animate-fade-in ${isPopular ? 'border-primary shadow-lg shadow-primary/10' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Популярный
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl font-display">{tariff.name}</CardTitle>
                  <CardDescription>{tariff.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-display font-bold text-foreground">
                      {tariff.price > 0 ? `${tariff.price.toLocaleString('ru-RU')} ₽` : 'Бесплатно'}
                    </span>
                    {tariff.price > 0 && (
                      <span className="text-muted-foreground text-sm"> / мес</span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="Check" size={16} className="text-primary shrink-0" />
                      До {tariff.max_companies} {tariff.max_companies === 1 ? 'компании' : 'компаний'}
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="Check" size={16} className="text-primary shrink-0" />
                      До {tariff.max_users} пользователей
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="Check" size={16} className="text-primary shrink-0" />
                      До {tariff.max_integrations} интеграций
                    </li>
                    {tariff.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon name="Check" size={16} className="text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                    onClick={onCtaClick}
                  >
                    Попробовать 7 дней бесплатно
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;