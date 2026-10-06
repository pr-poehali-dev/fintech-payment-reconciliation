import Icon from '@/components/ui/icon';

const PAINS = [
  {
    icon: 'Gavel',
    title: 'Один пропущенный чек — и вы платите',
    description:
      'Налоговая видит каждый платёж. Нет чека или в нём ошибка — приходит штраф, и он может быть равен всей сумме платежа. Вы заработали деньги, а потом отдали их государству.',
    fact: 'Штраф — вплоть до всей суммы платежа'
  },
  {
    icon: 'Clock',
    title: 'Вы платите за ручную сверку, а ошибки остаются',
    description:
      'Бухгалтер каждый месяц сводит платежи из CRM, банка и эквайринга с чеками в ОФД — строка за строкой. Вы оплачиваете эти часы, а пропущенные чеки всё равно проскакивают.',
    fact: 'Деньги на рутину, которая не защищает'
  },
  {
    icon: 'EyeOff',
    title: 'Касса сломалась — вы узнаете от налоговой',
    description:
      'Касса не отправила чек, закончился фискальный накопитель, отвалилась интеграция с CRM. Клиенты платят, чеков нет, и неделями этого никто не видит — пока не придёт требование.',
    fact: 'Каждый день сбоя — новые штрафы'
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
            Три причины, почему бизнес теряет деньги на чеках, и как это прекратить
          </h2>
          <p className="text-lg text-muted-foreground">
            За каждый не пробитый правильно чек бизнес платит штраф от 30 000 ₽.
            Десять таких ошибок за месяц — и 300 000 ₽ уходят из вашего кармана в бюджет.
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
          Сверка закрывает эти проблемы —{' '}
          <span className="text-primary font-semibold">автоматически и каждый день.</span>{' '}
          Заменит бухгалтера и кассира, минимизирует риск штрафа, покажет, с какой суммы платить налоги без доначислений.
        </p>
      </div>
    </section>
  );
};

export default PainsSection;