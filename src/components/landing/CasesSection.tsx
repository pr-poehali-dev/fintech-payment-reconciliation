import { useEffect, useState } from 'react';
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LandingCase } from '@/components/cases/caseTypes';

const CaseHeader = ({ item }: { item: LandingCase }) => (
  <div className="flex items-center gap-3 sm:gap-4">
    {item.logo_url ? (
      <img src={item.logo_url} alt={item.company_name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-background border border-border p-1 shrink-0" />
    ) : (
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon name="Building2" size={26} className="text-primary" />
      </div>
    )}
    <div className="min-w-0 text-left">
      <div className="font-display font-semibold text-base sm:text-lg text-foreground break-words">{item.company_name}</div>
      <div className="text-sm text-muted-foreground">{item.niche}</div>
    </div>
  </div>
);

const CaseBlock = ({ kind, text, clamp }: { kind: 'task' | 'solution'; text: string; clamp?: boolean }) => (
  <div>
    <div className={`flex items-center gap-2 text-sm font-medium mb-2 ${kind === 'task' ? 'text-destructive' : 'text-primary'}`}>
      <Icon name={kind === 'task' ? 'CircleAlert' : 'CircleCheck'} size={16} />
      {kind === 'task' ? 'Задача' : 'Решение'}
    </div>
    <p className={`text-sm leading-relaxed whitespace-pre-line ${kind === 'task' ? 'text-foreground' : 'text-muted-foreground'} ${clamp ? 'line-clamp-4' : ''}`}>
      {text}
    </p>
  </div>
);

const LONG_TEXT = 180;

const CaseCard = ({ item, onOpen }: { item: LandingCase; onOpen: () => void }) => {
  const isLong = item.task.length > LONG_TEXT || item.solution.length > LONG_TEXT
    || item.task.split('\n').length > 4 || item.solution.split('\n').length > 4;
  return (
    <div className="h-full flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div className="mb-6"><CaseHeader item={item} /></div>
      <div className="mb-5"><CaseBlock kind="task" text={item.task} clamp /></div>
      <div className="mt-auto pt-5 border-t border-border">
        <CaseBlock kind="solution" text={item.solution} clamp />
        {isLong && (
          <button type="button" onClick={onOpen} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Читать полностью
            <Icon name="ArrowRight" size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const CasesSection = ({ cases }: { cases: LandingCase[] }) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [snaps, setSnaps] = useState(0);
  const [opened, setOpened] = useState<LandingCase | null>(null);

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
                <CaseCard item={item} onOpen={() => setOpened(item)} />
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

        <Dialog open={!!opened} onOpenChange={(open) => !open && setOpened(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {opened && (
              <div className="space-y-6">
                <DialogTitle className="sr-only">{opened.company_name}</DialogTitle>
                <CaseHeader item={opened} />
                <CaseBlock kind="task" text={opened.task} />
                <div className="pt-5 border-t border-border">
                  <CaseBlock kind="solution" text={opened.solution} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default CasesSection;
