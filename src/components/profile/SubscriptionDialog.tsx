import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_STATUS, subscriptionEndDate, daysLeft, formatLongDate } from '@/lib/subscription';
import { APP_MODULES } from '@/config/modules';
import functionUrls from '../../../backend/func2url.json';
import DowngradeKeepPicker, {
  KeepState,
  Overage,
  initialKeep,
  keepIsValid,
  removalCount
} from './DowngradeKeepPicker';

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightModule?: string | null;
}

interface PlanTariff {
  slug: string;
  name: string;
  description?: string;
  price: number;
  period_days: number;
  yearly_discount_percent: number;
  year_price: number;
  modules: string[];
  max_companies: number | null;
  max_users: number | null;
  max_integrations: number | null;
  max_automations: number | null;
}

interface Payment {
  id: number;
  tariff_name: string;
  period: string;
  amount: number;
  period_end: string | null;
  created_at: string;
}

type Period = 'month' | 'year';

interface CurrentPlan {
  modules: string[];
  max_companies: number | null;
  max_users: number | null;
  max_integrations: number | null;
  max_automations: number | null;
}

type LimitKey = 'max_companies' | 'max_users' | 'max_integrations' | 'max_automations';

const LIMITS: { key: LimitKey; label: string }[] = [
  { key: 'max_companies', label: 'Компаний' },
  { key: 'max_users', label: 'Пользователей' },
  { key: 'max_integrations', label: 'Интеграций' },
  { key: 'max_automations', label: 'Автоматизаций' }
];

const money = (n: number) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;

// Изменение лимита относительно текущего тарифа: null в лимите - без ограничений.
const limitDiff = (next: number | null, cur: number | null | undefined): { up: boolean; text: string } | null => {
  if (cur === undefined) return null;
  if (cur === null && next === null) return null;
  if (next === null) return { up: true, text: '' };
  if (cur === null) return { up: false, text: '' };
  if (next === cur) return null;
  return next > cur ? { up: true, text: `+${next - cur}` } : { up: false, text: `−${cur - next}` };
};

const SubscriptionDialog = ({ open, onOpenChange, highlightModule }: SubscriptionDialogProps) => {
  const { currentCompany, refreshCompanies } = useAuth();
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<PlanTariff[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [canPay, setCanPay] = useState(false);
  const [current, setCurrent] = useState<CurrentPlan | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [selected, setSelected] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<{ title: string; until: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [overage, setOverage] = useState<Overage | null>(null);
  const [checking, setChecking] = useState(false);
  const [keep, setKeep] = useState<KeepState>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (paid || payError) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [paid, payError]);

  const companyId = currentCompany?.id;

  const load = () => {
    if (!companyId) return;
    fetch(`${functionUrls['subscription-checkout']}?company_id=${companyId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setTariffs(d.tariffs || []);
        setPayments(d.payments || []);
        setCanPay(Boolean(d.can_pay));
        setCurrent(d.current || null);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setPaid(null);
    setPayError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  const status = SUBSCRIPTION_STATUS[currentCompany?.subscription_status || ''] || {
    label: currentCompany?.subscription_status || 'Нет подписки',
    className: 'bg-muted text-muted-foreground border-border'
  };
  const isTrial = currentCompany?.subscription_status === 'trial';
  const endDate = subscriptionEndDate(currentCompany);
  const left = daysLeft(endDate);
  const currentSlug = currentCompany?.tariff_slug;
  const currentPaid = tariffs.find((t) => t.slug === currentSlug);
  const chosen = tariffs.find((t) => t.slug === selected) || null;
  const isRenewal = Boolean(chosen && chosen.slug === currentSlug && !isTrial);

  useEffect(() => {
    setOverage(null);
    setKeep({});
    setConfirmDelete(false);
    if (!selected || !companyId) return;
    let cancelled = false;
    setChecking(true);
    fetch(functionUrls['subscription-checkout'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', company_id: companyId, tariff_slug: selected })
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.success) return;
        const over: Overage = d.overage || {};
        if (Object.keys(over).length) {
          setOverage(over);
          setKeep(initialKeep(over));
        }
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [selected, companyId]);

  const removing = overage ? removalCount(overage, keep) : 0;
  const keepValid = !overage || keepIsValid(overage, keep);
  const payBlocked = checking || !keepValid || (removing > 0 && !confirmDelete);

  const pay = async () => {
    if (!chosen || !companyId) return;
    setPaying(true);
    setPayError(null);
    setPaid(null);
    try {
      const res = await fetch(functionUrls['subscription-checkout'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          company_id: companyId,
          tariff_slug: chosen.slug,
          period,
          keep: overage ? keep : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message = data.error || `Сервер ответил ошибкой (${res.status})`;
        setPayError(message);
        toast({ title: 'Не удалось оплатить', description: message, variant: 'destructive' });
        return;
      }
      const result = {
        title: isRenewal
          ? `Оплата принята, тариф «${data.tariff_name}» продлён`
          : `Оплата принята, тариф «${data.tariff_name}» оплачен`,
        until: formatLongDate(data.period_end)
      };
      const removedTotal = Object.values((data.removed || {}) as Record<string, number>).reduce((a, b) => a + b, 0);
      if (removedTotal > 0) result.title += `. Удалено лишнего: ${removedTotal}`;
      setPaid(result);
      toast({ title: result.title, description: `Срок действия: до ${result.until}` });
      setSelected(null);
      await refreshCompanies();
      load();
    } catch {
      setPayError('Нет связи с сервером, попробуйте ещё раз');
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const price = (t: PlanTariff) => (period === 'year' ? t.year_price : t.price);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Подписка</DialogTitle>
          <DialogDescription>
            {currentCompany ? `Тариф компании «${currentCompany.name}»` : 'Компания не выбрана'}
          </DialogDescription>
        </DialogHeader>

        {currentCompany && (
          <div className="space-y-6 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Текущий тариф</div>
                  <div className="text-xl font-display font-bold">{currentCompany.tariff_name || '—'}</div>
                </div>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {isTrial ? 'Пробный период до' : 'Оплачено до'}:{' '}
                  <span className="font-medium text-foreground">{formatLongDate(endDate)}</span>
                  {left !== null && (
                    <span className={`ml-2 font-medium ${left <= 3 ? 'text-warning' : 'text-primary'}`}>
                      {left > 0 ? `(осталось дней: ${left})` : '(срок закончился)'}
                    </span>
                  )}
                </span>
                {canPay && currentPaid && !isTrial && (
                  <Button size="sm" onClick={() => setSelected(currentPaid.slug)}>
                    <Icon name="RefreshCw" size={16} className="mr-2" />
                    Продлить
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">{isTrial ? 'Выберите тариф' : 'Тарифы'}</h3>
                <div className="inline-flex rounded-lg border border-border p-1">
                  {(['month', 'year'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                        period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p === 'month' ? 'Месяц' : 'Год — выгоднее'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                          onClick={() => setSelected(t.slug)}
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

            {chosen && canPay && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">
                      {isRenewal ? `Продление тарифа «${chosen.name}»` : `Переход на тариф «${chosen.name}»`}
                    </div>
                    <div className="text-muted-foreground">
                      {period === 'year' ? 'На 365 дней' : `На ${chosen.period_days} дн.`}
                      {isRenewal ? ' — добавится к текущему сроку' : ' — с сегодняшнего дня'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setSelected(null)} disabled={paying}>
                      Отмена
                    </Button>
                    <Button
                      onClick={pay}
                      disabled={paying || payBlocked}
                      variant={removing > 0 ? 'destructive' : 'default'}
                    >
                      <Icon
                        name={paying ? 'Loader2' : 'CreditCard'}
                        size={16}
                        className={`mr-2 ${paying ? 'animate-spin' : ''}`}
                      />
                      Оплатить {money(price(chosen))}
                    </Button>
                  </div>
                </div>

                {checking && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon name="Loader2" size={14} className="animate-spin" />
                    Проверяем лимиты тарифа…
                  </div>
                )}

                {overage && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                      <Icon name="TriangleAlert" size={20} className="mt-0.5 shrink-0 text-destructive" />
                      <div>
                        <div className="font-semibold text-foreground">
                          В тариф «{chosen.name}» помещается не всё, что есть сейчас
                        </div>
                        <div className="text-muted-foreground">
                          Отметьте, что оставить. Всё неотмеченное будет удалено безвозвратно при оплате — восстановить
                          это будет нельзя, даже если потом перейти на тариф выше.
                        </div>
                      </div>
                    </div>

                    <DowngradeKeepPicker overage={overage} keep={keep} onChange={setKeep} />

                    {removing > 0 && (
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
                        <Checkbox
                          checked={confirmDelete}
                          onCheckedChange={(v) => setConfirmDelete(Boolean(v))}
                          className="mt-0.5"
                        />
                        <span>
                          Понимаю, что <span className="font-semibold text-destructive">{removing}</span>{' '}
                          {removing === 1 ? 'элемент будет удалён' : 'элементов будут удалены'} навсегда вместе со всеми
                          данными
                        </span>
                      </label>
                    )}
                    {!keepValid && (
                      <div className="text-sm text-destructive">Отмечено больше, чем позволяет тариф.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {paid && (
              <div ref={resultRef} />
            )}
            {paid && (
              <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
                <Icon name="CircleCheck" size={22} className="mt-0.5 shrink-0 text-success" />
                <div className="text-sm">
                  <div className="font-semibold text-foreground">{paid.title}</div>
                  <div className="text-muted-foreground">
                    Срок действия: до <span className="font-medium text-foreground">{paid.until}</span>
                  </div>
                </div>
              </div>
            )}
            {payError && <div ref={resultRef} />}
            {payError && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
                <Icon name="CircleAlert" size={22} className="mt-0.5 shrink-0 text-destructive" />
                <div>
                  <div className="font-semibold text-foreground">Не удалось оплатить</div>
                  <div className="text-muted-foreground">{payError}</div>
                </div>
              </div>
            )}
            {payments.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">История оплат</h3>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        {formatLongDate(p.created_at)} · {p.tariff_name} · {p.period === 'year' ? 'год' : 'месяц'}
                      </span>
                      <span className="font-medium">{money(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
