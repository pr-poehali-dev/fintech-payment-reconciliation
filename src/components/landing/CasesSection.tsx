import { useEffect, useState } from 'react';
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Icon from '@/components/ui/icon';
import { LandingCase } from '@/components/cases/caseTypes';

const CaseCard = ({ item }: { item: LandingCase }) => (
  <div className="h-full flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-8">
    <div className="flex items-center gap-3 sm:gap-4 mb-6">
      {item.logo_url ? (
        <img src={item.logo_url} alt={item.company_name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-background border border-border p-1 shrink-0" />
      ) : (
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon name="Building2" size={26} className="text-primary" />
        </div>
      )}
      <div className="min-w-0">
        <div className="font-display font-semibold text-base sm:text-lg text-foreground break-words">{item.company_name}</div>
        <div className="text-sm text-muted-foreground">{item.niche}</div>
      </div>
    </div>
    <div className="mb-5">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
        <Icon name="CircleAlert" size={16} />
        Задача
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{item.task}</p>
    </div>
    <div className="mt-auto pt-5 border-t border-border">
      <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
        <Icon name="CircleCheck" size={16} />
        Решение
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.solution}</p>
    </div>
  </div>
);

const CasesSection = ({ cases }: { cases: LandingCase[] }) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [snaps, setSnaps] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setSnaps(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    };
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => {
      api.off('select', update);
      api.off('reInit', update);
    };
  }, [api]);

  if (!cases.length) return null;

  return (
    <section id="cases" className="py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Популярные проблемы, которые мы решаем бизнесам
          </h2>
          <p className="text-lg text-muted-foreground">
            Кейсы клиентов — показываем на примере, какие задачи можно решить внутри сервиса
          </p>
        </div>

        <Carousel setApi={setApi} opts={{ align: 'start', loop: cases.length > 2 }}>
          <CarouselContent className="-ml-4">
            {cases.map((item) => (
              <CarouselItem key={item.id} className="pl-4 basis-[88%] sm:basis-[70%] md:basis-1/2">
                <CaseCard item={item} />
              </CarouselItem>
            ))}
          </CarouselContent>
          {snaps > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <CarouselPrevious className="static translate-y-0" />
              <div className="flex items-center gap-2">
                {Array.from({ length: snaps }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Кейс ${i + 1}`}
                    onClick={() => api?.scrollTo(i)}
                    className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'}`}
                  />
                ))}
              </div>
              <CarouselNext className="static translate-y-0" />
            </div>
          )}
        </Carousel>
      </div>
    </section>
  );
};

export default CasesSection;
