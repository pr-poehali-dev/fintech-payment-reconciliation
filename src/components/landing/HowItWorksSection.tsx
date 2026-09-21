import Icon from '@/components/ui/icon';

const STEPS = [
  {
    number: '01',
    icon: 'UserPlus',
    title: 'Регистрируетесь по телефону',
    description: 'Без пароля — вход по коду из WhatsApp, Telegram или Max. Создаёте компанию за пару минут.'
  },
  {
    number: '02',
    icon: 'Plug',
    title: 'Подключаете источники данных',
    description: 'CRM, платёжные системы, ОФД, банк — интеграция настраивается в интерфейсе, без кода.'
  },
  {
    number: '03',
    icon: 'GitCompare',
    title: 'Платформа сверяет автоматически',
    description: 'Каждый платёж и заказ сопоставляется с чеком, включая авансы и их зачёт по факту отгрузки.'
  },
  {
    number: '04',
    icon: 'ShieldCheck',
    title: 'Вы видите расхождения раньше проверки',
    description: 'Уведомления и отчёты показывают проблему сразу — до того, как её найдёт налоговая.'
  }
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
            Как это работает
          </h2>
          <p className="text-lg text-muted-foreground">
            От регистрации до первого автоматического отчёта — четыре простых шага.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '2rem' }}>
          {STEPS.map((step, index) => (
            <div key={step.number} className="relative animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Icon name={step.icon as any} size={20} className="text-primary-foreground" />
                </div>
                <span className="text-3xl font-display font-bold text-muted-foreground/30">
                  {step.number}
                </span>
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>

              {index < STEPS.length - 1 && (
                <Icon
                  name="ArrowRight"
                  size={20}
                  className="hidden lg:block absolute top-5 -right-4 text-border"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;