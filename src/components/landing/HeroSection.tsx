import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const HERO_STATS = [
  { value: '54-ФЗ', label: 'Полное соответствие закону' },
  { value: '100%', label: 'Автоматический учёт чеков' },
  { value: '24/7', label: 'Контроль касс онлайн' }
];

const HeroSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Icon name="ShieldCheck" size={14} className="text-primary" />
              <span className="text-xs font-medium text-primary">Платформа сверки по 54-ФЗ</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              Каждый платёж —<br />
              <span className="text-primary">с чеком.</span> Всегда.
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-xl">
              Екомкасса ПРО автоматически сверяет платежи из CRM, банков и эквайринга
              с чеками из ОФД и кассы — чтобы бизнес не получил штраф за отсутствие
              фискального документа.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button size="lg" onClick={onCtaClick} className="text-base h-14 px-8 gap-2">
                <Icon name="Rocket" size={18} />
                Попробовать 7 дней бесплатно
              </Button>
              <Button size="lg" variant="outline" className="text-base h-14 px-8 gap-2" asChild>
                <a href="#how-it-works">
                  <Icon name="PlayCircle" size={18} />
                  Как это работает
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Без банковской карты. Отменить можно в любой момент.
            </p>
          </div>

          <div className="relative animate-scale-in">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl blur-2xl" />
            <img
              src="https://cdn.poehali.dev/projects/c3bbcaf6-3ec5-48e5-aa2f-c4a750b45031/files/6c3e72d7-e59e-4bb4-bcdf-7b0932de6778.jpg"
              alt="Автоматическая сверка платежей и чеков"
              className="relative rounded-3xl w-full shadow-2xl border border-border"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-20 pt-10 border-t border-border">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-display font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
