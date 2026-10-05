import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_STATUS, subscriptionEndDate, daysLeft, formatLongDate } from '@/lib/subscription';
import functionUrls from '../../backend/func2url.json';
import {
  KeepState,
  Overage,
  initialKeep,
  keepIsValid,
  removalCount
} from '@/components/profile/DowngradeKeepPicker';
import { CurrentPlan, Payment, Period, PlanTariff } from '@/components/subscription/subscriptionTypes';
import CurrentPlanCard from '@/components/subscription/CurrentPlanCard';
import TariffPlansSection from '@/components/subscription/TariffPlansSection';
import CheckoutPanel from '@/components/subscription/CheckoutPanel';
import PaymentResultAndHistory from '@/components/subscription/PaymentResultAndHistory';

interface SubscriptionPageProps {
  highlightModule?: string | null;
}

const SubscriptionPage = ({ highlightModule }: SubscriptionPageProps) => {
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
    setSelected(null);
    setPaid(null);
    setPayError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

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
    <div className="max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h2 className="mb-2 text-3xl font-display font-bold text-foreground">Подписка</h2>
        <p className="text-muted-foreground">
          {currentCompany ? `Тариф, оплата и история платежей компании «${currentCompany.name}»` : 'Компания не выбрана'}
        </p>
      </div>

        {currentCompany && (
          <div className="space-y-6 py-2">
            <CurrentPlanCard
              tariffName={currentCompany.tariff_name}
              status={status}
              isTrial={isTrial}
              endDate={endDate}
              left={left}
              canPay={canPay}
              currentPaid={currentPaid}
              onRenew={setSelected}
            />

            <TariffPlansSection
              tariffs={tariffs}
              current={current}
              currentSlug={currentSlug}
              isTrial={isTrial}
              selected={selected}
              period={period}
              canPay={canPay}
              highlightModule={highlightModule}
              price={price}
              onPeriodChange={setPeriod}
              onSelect={setSelected}
            />

            {chosen && canPay && (
              <CheckoutPanel
                chosen={chosen}
                isRenewal={isRenewal}
                period={period}
                paying={paying}
                payBlocked={payBlocked}
                removing={removing}
                checking={checking}
                overage={overage}
                keep={keep}
                keepValid={keepValid}
                confirmDelete={confirmDelete}
                price={price}
                onCancel={() => setSelected(null)}
                onPay={pay}
                onKeepChange={setKeep}
                onConfirmDeleteChange={setConfirmDelete}
              />
            )}

            <PaymentResultAndHistory paid={paid} payError={payError} resultRef={resultRef} payments={payments} />
          </div>
        )}
    </div>
  );
};

export default SubscriptionPage;
