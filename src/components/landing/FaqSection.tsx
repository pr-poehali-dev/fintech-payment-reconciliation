import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQ = [
  {
    question: 'Нужен ли программист, чтобы подключить сервис?',
    answer: 'Нет. CRM, платёжные системы, ОФД, Екомкасса и банк подключаются прямо в интерфейсе за несколько минут — достаточно ввести данные доступа.'
  },
  {
    question: 'Как сервис находит пропущенные чеки?',
    answer: 'Сверка сопоставляет каждый платёж и заказ с чеками из ОФД и кассы, включая авансы и их зачёт. Если по оплате нет чека или сумма не совпадает, вы сразу видите это в отчёте и получаете уведомление.'
  },
  {
    question: 'Может ли сервис сам исправить расхождение?',
    answer: 'Да. Вы настраиваете сценарии автоматизации: например, создать чек при оплате заказа в CRM или оформить чек коррекции, если чек не был пробит вовремя.'
  },
  {
    question: 'Может ли бухгалтер вести несколько компаний в одном аккаунте?',
    answer: 'Да. Владелец компании приглашает бухгалтера с нужными правами, и тот переключается между всеми компаниями, к которым у него есть доступ, без отдельных регистраций.'
  },
  {
    question: 'Что будет после окончания бесплатного периода?',
    answer: 'Вы выбираете подходящий тариф и продолжаете работу — все подключения, сценарии и история сверок сохраняются.'
  }
];

const FaqSection = () => (
  <section id="faq" className="py-20 sm:py-28 scroll-mt-16">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground text-center mb-12">
        Популярные вопросы
      </h2>
      <Accordion type="single" collapsible className="space-y-3">
        {FAQ.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl bg-card px-5">
            <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FaqSection;
