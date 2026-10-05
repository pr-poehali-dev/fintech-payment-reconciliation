import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { APP_MODULES } from '@/config/modules';
import { CurrentPlan, LIMITS, Period, PlanTariff, limitDiff, money } from './subscriptionTypes';

interface TariffPlansSectionProps {
  tariffs: PlanTariff[];
  current: CurrentPlan | null;
  currentSlug?: string | null;
  isTrial: boolean;
  selected: string | null;
  period: Period;
  canPay: boolean;
  highlightModule?: string | null;
  price: (t: PlanTariff) => number;
  onPeriodChange: (p: Period) => void;
  onSelect: (slug: string) => void;
}

const TariffPlansSection = ({
  tariffs,
  current,
  currentSlug,
  isTrial,
  selected,
  period,
  canPay,
  highlightModule,
  price,
  onPeriodChange,
  onSelect
}: TariffPlansSectionProps) => (
  <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">{isTrial ? 'Выберите тариф' : 'Тарифы'}</h3>
      <div className="inline-flex rounded-lg border border-border p-1">
        {(['month', 'year'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p === 'month' ? 'Месяц' : 'Год — выгоднее'}
          </button>
        ))}
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tariffs.map((t) => {
        const isCurrent = t.slug === currentSlug && !isTrial;
        const isChosen = t.slug === selected;
        const opensModule = highlightModule && t.modules.includes(highlightModule);
        return (
          <div
            key={t.slug}
            className={`flex flex-col rounded-xl border p-4 transition-colors ${
              isChosen ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-display text-lg font-bold">{t.name}</div>
              {isCurrent && <Badge variant="outline">Ваш тариф</Badge>}
              {!isCurrent && opensModule && (
                <Badge variant="outline" className="border-primary/30 bg-primary/15 text-primary">
                  Откроет раздел
                </Badge>
              )}
            </div>
            <div className="mt-1">
              <span className="text-2xl font-bold">{money(price(t))}</span>
              <span className="text-sm text-muted-foreground">
                {' '}/ {period === 'year' ? 'год' : `${t.period_days} дн.`}
              </span>
            </div>
            {period === 'year' && t.yearly_discount_percent > 0 && (
              <div className="text-xs text-primary">
                Скидка {t.yearly_discount_percent}% — вместо {money(t.price * 12)}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {APP_MODULES.filter((m) => !m.hidden).map((m) => {
                const on = t.modules.includes(m.id);
                const had = current !== null && current.modules.includes(m.id);
                const added = on && !isCurrent && current !== null && !had;
                const lost = !on && !isCurrent && had;
                return (
                  <span
                    key={m.id}
                    title={added ? 'Добавится к вашему тарифу' : lost ? 'Пропадёт при переходе' : undefined}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                      added
                        ? 'bg-success/15 text-success font-medium'
                        : lost
                          ? 'bg-destructive/15 text-destructive font-medium line-through'
                          : on
                            ? 'bg-primary/10 text-foreground'
                            : 'bg-muted text-muted-foreground line-through'
                    }`}
                  >
                    <Icon name={added ? 'Plus' : lost ? 'Minus' : on ? 'Check' : 'X'} size={12} />
                    {m.name}
                  </span>
                );
              })}
            </div>
            <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
              {LIMITS.map(({ key, label }) => {
                const diff = isCurrent ? null : limitDiff(t[key], current?.[key]);
                const color = diff ? (diff.up ? 'text-success' : 'text-destructive') : '';
                return (
                  <li key={key}>
                    {label}: {t[key] === null ? 'без ограничений' : t[key]}
                    {diff && diff.text && <span className={`ml-1.5 font-semibold ${color}`}>{diff.text}</span>}
                    {diff && !diff.text && (
                      <Icon name={diff.up ? 'ArrowUp' : 'ArrowDown'} size={12} className={`ml-1 inline ${color}`} />
                    )}
                  </li>
                );
              })}
            </ul>
            {canPay && (
              <Button
                className="mt-auto pt-0"
                style={{ marginTop: 16 }}
                variant={isChosen ? 'default' : 'outline'}
                onClick={() => onSelect(t.slug)}
              >
                {isCurrent ? 'Продлить' : isTrial ? 'Выбрать' : 'Перейти'}
              </Button>
            )}
          </div>
        );
      })}
    </div>

    {!canPay && (
      <p className="mt-3 text-sm text-muted-foreground">
        Оплатить или сменить тариф может владелец или админ компании.
      </p>
    )}
  </div>
);

export default TariffPlansSection;
