import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const CtaSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-3xl p-10 sm:p-16">
          <Icon name="ShieldCheck" size={40} className="text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Начните контролировать чеки уже сегодня
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            7 дней бесплатно, без банковской карты. Подключите первую компанию за пару минут.
          </p>
          <Button size="lg" onClick={onCtaClick} className="text-base h-14 px-10 gap-2">
            <Icon name="Rocket" size={18} />
            Попробовать 7 дней бесплатно
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
