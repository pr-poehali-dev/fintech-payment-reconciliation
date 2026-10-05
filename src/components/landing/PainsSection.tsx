import Icon from '@/components/ui/icon';

const PAINS = [
  {
    icon: 'Gavel',
    title: 'Штраф за один пропущенный чек',
    description:
      'Налоговая видит платёж без чека — и выписывает штраф, который может достигать полной суммы платежа. Узнаёте об этом, когда уже поздно что-то исправить.',
    fact: 'Штраф — до 100% суммы платежа'
  },
  {
    icon: 'Clock',
    title: 'Часы ручной сверки каждый месяц',
    description:
      'Бухгалтер выгружает платежи из CRM, банка и эквайринга, а потом по одному ищет к ним чеки в ОФД. Долго, дорого и всё равно с ошибками.',
    fact: 'Десятки часов рутины в месяц'
  },
  {
    icon: 'EyeOff',
    title: 'Сбои касс никто не замечает',
    description:
      'Касса не отправила чек, закончился фискальный накопитель, интеграция с CRM упала — а деньги продолжают приходить без чеков, и вы об этом не знаете.',
    fact: 'Ошибки копятся незаметно'
  }
];

const PainsSection = () => {
  return (
    <section id="pains" className="pt-4 pb-20 sm:pt-8 sm:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 mb-6">
            <Icon name="TriangleAlert" size={14} className="text-destructive" />
            <span className="text-xs font-medium text-destructive">Знакомо?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Почему пропущенные чеки — головная боль бизнеса
          </h2>
          <p className="text-lg text-muted-foreground">
            Платежи приходят из разных каналов, а отвечаете за каждый чек вы.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PAINS.map((pain, index) => (
            <div
              key={pain.title}
              className="relative flex flex-col rounded-2xl border border-border bg-card p-8 hover:border-destructive/40 transition-colors animate-fade-in"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mb-6">
                <Icon name={pain.icon} fallback="CircleAlert" size={26} className="text-destructive" />
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground mb-3">{pain.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{pain.description}</p>
              <div className="flex items-center gap-2 pt-4 border-t border-border text-sm font-medium text-destructive">
                <Icon name="ArrowDownRight" size={16} />
                {pain.fact}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-lg text-foreground mt-12">
          Сверка закрывает все три проблемы —{' '}
          <span className="text-primary font-semibold">автоматически и каждый день.</span>
        </p>
      </div>
    </section>
  );
};

export default PainsSection;