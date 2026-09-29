import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../../backend/func2url.json';

interface BankIntegration {
  id: number;
  name: string;
}

interface BackfillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasEcomkassa: boolean;
  hasOfd: boolean;
  bankIntegrations: BankIntegration[];
  onFinished: () => void;
}

const ORDER_TYPES: { id: string; label: string }[] = [
  { id: 'VCHR', label: 'Чеки' },
  { id: 'INVC', label: 'Счета' },
];

const STATUSES: { id: string; label: string }[] = [
  { id: 'COMPLETED', label: 'Успешно завершён' },
  { id: 'PAID', label: 'Оплачен' },
];

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d;
};

const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

type Phase = 'idle' | 'running' | 'done';

const BackfillDialog = ({ open, onOpenChange, hasEcomkassa, hasOfd, bankIntegrations, onFinished }: BackfillDialogProps) => {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const [dateFrom, setDateFrom] = useState<Date>(monthAgo());
  const [dateTo, setDateTo] = useState<Date>(yesterday());
  const [orderTypes, setOrderTypes] = useState<string[]>(['VCHR']);
  const [statuses, setStatuses] = useState<string[]>(['COMPLETED']);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [ecomkassaProgress, setEcomkassaProgress] = useState({ processed: 0, total: 0, inserted: 0 });
  const [ofdResult, setOfdResult] = useState<{ inserted: number; total: number } | null>(null);
  const [bankResults, setBankResults] = useState<Record<number, { inserted: number; total: number }>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const toggleOrderType = (id: string) => {
    setOrderTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const toggleStatus = (id: string) => {
    setStatuses((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const resetState = () => {
    setPhase('idle');
    setEcomkassaProgress({ processed: 0, total: 0, inserted: 0 });
    setOfdResult(null);
    setBankResults({});
    setErrors([]);
  };

  const runEcomkassaBackfill = async () => {
    if (!companyId || orderTypes.length === 0 || statuses.length === 0) return;

    let offset = 0;
    let done = false;
    let totalInserted = 0;
    let matchedTotal = 0;

    try {
      while (!done) {
        const res = await fetch(functionUrls['ecomkassa-fetch-orders'], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            date_from: dateFrom.toISOString(),
            date_to: dateTo.toISOString(),
            order_types: orderTypes,
            statuses,
            offset,
            batch_size: 8
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrors((prev) => [...prev, data.error || 'Не удалось загрузить данные из Екомкассы']);
          return;
        }

        matchedTotal = data.matched_total;
        totalInserted += data.inserted;
        offset = data.next_offset ?? offset + data.processed;
        done = data.done;

        setEcomkassaProgress({ processed: offset, total: matchedTotal, inserted: totalInserted });
      }
    } catch {
      // Сетевой сбой (не HTTP-ошибка) - ловим здесь, чтобы Promise.all в
      // handleStart не завис навсегда и диалог не заблокировался в 'running'.
      setErrors((prev) => [...prev, 'Екомкасса: сбой сети, попробуйте ещё раз']);
    }
  };

  const runOfdBackfill = async () => {
    if (!companyId) return;

    try {
      const res = await fetch(functionUrls['ofd-fetch-receipts'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString()
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrors((prev) => [...prev, data.error || 'Не удалось загрузить чеки ОФД']);
        return;
      }

      setOfdResult({ inserted: data.inserted ?? 0, total: data.total_receipts ?? 0 });
    } catch {
      setErrors((prev) => [...prev, 'ОФД: сбой сети, попробуйте ещё раз']);
    }
  };

  const runBankBackfill = async (integration: BankIntegration) => {
    if (!companyId) return;

    try {
      const res = await fetch(functionUrls['bank-statement-sync'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_id: integration.id,
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString()
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrors((prev) => [...prev, `${integration.name}: ${data.error || 'не удалось загрузить выписку'}`]);
        return;
      }

      setBankResults((prev) => ({
        ...prev,
        [integration.id]: { inserted: data.inserted ?? 0, total: data.total_transactions ?? data.inserted ?? 0 }
      }));
    } catch {
      setErrors((prev) => [...prev, `${integration.name}: сбой сети, попробуйте ещё раз`]);
    }
  };

  const handleStart = async () => {
    resetState();
    setPhase('running');

    const tasks: Promise<void>[] = [];
    if (hasEcomkassa) tasks.push(runEcomkassaBackfill());
    if (hasOfd) tasks.push(runOfdBackfill());
    bankIntegrations.forEach((bi) => tasks.push(runBankBackfill(bi)));

    await Promise.all(tasks);

    setPhase('done');
    onFinished();
  };

  const handleClose = (nextOpen: boolean) => {
    if (phase === 'running') return;
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  const hasAnySource = hasEcomkassa || hasOfd || bankIntegrations.length > 0;
  const canStart = hasAnySource && (!hasEcomkassa || (orderTypes.length > 0 && statuses.length > 0));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Download" size={20} />
            Дозагрузка исторических данных
          </DialogTitle>
          <DialogDescription>
            Подтянем чеки, счета и операции по счёту за выбранный период из всех
            подключённых интеграций — пригодится, если часть данных не пришла вебхуком
          </DialogDescription>
        </DialogHeader>

        {!hasAnySource ? (
          <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-4">
            <Icon name="AlertTriangle" size={20} className="text-muted-foreground shrink-0" />
            <div className="text-sm text-muted-foreground">
              У компании нет активных интеграций с поддержкой дозагрузки (касса Екомкасса, ОФД
              или расчётный счёт) — сначала подключите их в разделе «Интеграции»
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Период</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 w-full justify-start" disabled={phase === 'running'}>
                    <Icon name="Calendar" size={14} />
                    {format(dateFrom, 'd MMM yyyy', { locale: ru })} — {format(dateTo, 'd MMM yyyy', { locale: ru })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateFrom, to: dateTo } as DateRange}
                    onSelect={(range) => {
                      if (!range?.from) return;
                      setDateFrom(range.from);
                      if (range.to) setDateTo(range.to);
                    }}
                    disabled={{ after: yesterday() }}
                    numberOfMonths={2}
                    defaultMonth={dateFrom}
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {hasEcomkassa && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Icon name="Store" size={14} />
                    Екомкасса — типы документов
                  </Label>
                  <div className="flex gap-4">
                    {ORDER_TYPES.map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`type-${t.id}`}
                          checked={orderTypes.includes(t.id)}
                          onCheckedChange={() => toggleOrderType(t.id)}
                          disabled={phase === 'running'}
                        />
                        <Label htmlFor={`type-${t.id}`} className="text-sm font-normal cursor-pointer">
                          {t.label}
                        </Label>
                      </div>
                    ))}
                  </div>

                  <Label className="text-sm font-medium">Статусы</Label>
                  <div className="flex gap-4">
                    {STATUSES.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`status-${s.id}`}
                          checked={statuses.includes(s.id)}
                          onCheckedChange={() => toggleStatus(s.id)}
                          disabled={phase === 'running'}
                        />
                        <Label htmlFor={`status-${s.id}`} className="text-sm font-normal cursor-pointer">
                          {s.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {hasOfd && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Receipt" size={14} />
                  ОФД: загрузятся все чеки за период (фильтров по типу/статусу у ОФД нет)
                </div>
              </>
            )}

            {bankIntegrations.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Landmark" size={14} />
                  Расчётный счёт ({bankIntegrations.map((b) => b.name).join(', ')}): загрузятся все операции за период
                </div>
              </>
            )}

            {phase !== 'idle' && (
              <>
                <Separator />
                <div className="space-y-3">
                  {hasEcomkassa && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Екомкасса</span>
                        <span className="font-medium">
                          {ecomkassaProgress.total > 0
                            ? `${Math.min(ecomkassaProgress.processed, ecomkassaProgress.total)} из ${ecomkassaProgress.total} · загружено ${ecomkassaProgress.inserted}`
                            : phase === 'running' ? 'Ищем документы…' : 'Готово'}
                        </span>
                      </div>
                      <Progress
                        value={ecomkassaProgress.total > 0 ? Math.min(100, (ecomkassaProgress.processed / ecomkassaProgress.total) * 100) : (phase === 'running' ? 10 : 100)}
                      />
                    </div>
                  )}

                  {hasOfd && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {phase === 'running' && !ofdResult ? (
                          <Icon name="Loader2" size={13} className="animate-spin" />
                        ) : (
                          <Icon name="CheckCircle2" size={13} className="text-success" />
                        )}
                        ОФД
                      </span>
                      <span className="font-medium">
                        {ofdResult ? `загружено ${ofdResult.inserted} из ${ofdResult.total}` : phase === 'running' ? 'Загрузка…' : ''}
                      </span>
                    </div>
                  )}

                  {bankIntegrations.map((bi) => {
                    const result = bankResults[bi.id];
                    return (
                      <div key={bi.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          {phase === 'running' && !result ? (
                            <Icon name="Loader2" size={13} className="animate-spin" />
                          ) : (
                            <Icon name="CheckCircle2" size={13} className="text-success" />
                          )}
                          {bi.name}
                        </span>
                        <span className="font-medium">
                          {result ? `загружено ${result.inserted} из ${result.total}` : phase === 'running' ? 'Загрузка…' : ''}
                        </span>
                      </div>
                    );
                  })}

                  {errors.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
                      {errors.map((err, i) => (
                        <div key={i} className="text-xs text-destructive flex items-start gap-1.5">
                          <Icon name="XCircle" size={13} className="shrink-0 mt-0.5" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}

                  {phase === 'done' && errors.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <Icon name="CheckCircle2" size={14} />
                      Загрузка завершена
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'done' ? (
            <Button onClick={() => handleClose(false)} className="w-full">
              Готово
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={!canStart || phase === 'running'}
              className="w-full gap-2"
            >
              {phase === 'running' ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  Загружаем…
                </>
              ) : (
                <>
                  <Icon name="Download" size={16} />
                  Начать загрузку
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackfillDialog;