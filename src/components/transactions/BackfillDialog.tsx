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
import { useBackfill, BankIntegration } from '@/contexts/BackfillContext';

interface NamedIntegration {
  id: number;
  name: string;
}

interface BackfillDialogProps {
  ecomkassaIntegrations: NamedIntegration[];
  ofdIntegrations: NamedIntegration[];
  bankIntegrations: BankIntegration[];
}

// INVC у Екомкассы технически "счёт" (invoice с отложенной оплатой), но для
// пользователя понятнее "Платежи" - счёт с оплатой через шлюз это и есть факт
// платежа. CORD (курьерский заказ) оставляем "Заказы" - это отдельная сущность
// с доставкой, а не просто способ оплаты.
const ORDER_TYPES: { id: string; label: string }[] = [
  { id: 'VCHR', label: 'Чеки' },
  { id: 'INVC', label: 'Платежи' },
  { id: 'CORD', label: 'Заказы' },
];

const STATUSES: { id: string; label: string }[] = [
  { id: 'COMPLETED', label: 'Успешно завершён' },
  { id: 'PAID', label: 'Оплачен' },
];

// Верхняя граница периода - конец СЕГОДНЯШНЕГО дня: ручная дозагрузка
// должна уметь подтянуть и то, что пришло сегодня (сверка при этом по-прежнему
// считает только закрытые дни - это ограничение самой Сверки, не загрузки).
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Диалог - только "витрина" для процесса, который живёт в BackfillContext
// (смонтирован на уровне App.tsx, выше страниц). Свернуть окно (крестик/клик
// вне) больше не останавливает загрузку - она продолжается в фоне и просто
// не отображается, пока диалог снова не откроют кнопкой "Загрузить".
const BackfillDialog = ({ ecomkassaIntegrations, ofdIntegrations, bankIntegrations }: BackfillDialogProps) => {
  const hasEcomkassa = ecomkassaIntegrations.length > 0;
  const hasOfd = ofdIntegrations.length > 0;
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const {
    isDialogOpen, closeDialog, reset,
    phase, ecomkassaProgress, ofdResult, bankResults, errors,
    start
  } = useBackfill();

  const [dateRange, setDateRange] = useState<DateRange>({ from: monthAgo(), to: endOfToday() });
  const dateFrom = dateRange.from ?? monthAgo();
  const dateTo = dateRange.to ?? dateFrom;
  const [orderTypes, setOrderTypes] = useState<string[]>(['VCHR']);
  const [statuses, setStatuses] = useState<string[]>(['COMPLETED']);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const toggleOrderType = (id: string) => {
    setOrderTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const toggleStatus = (id: string) => {
    setStatuses((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleStart = () => {
    if (!companyId) return;
    // Календарь отдаёт даты на полночь - конец периода растягиваем до конца
    // дня, иначе последний выбранный день (в т.ч. сегодня) не попадал в
    // загрузку целиком.
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    start({
      companyId,
      dateFrom: from,
      dateTo: to,
      hasEcomkassa,
      orderTypes,
      statuses,
      hasOfd,
      bankIntegrations
    });
  };

  // Закрытие окна (в т.ч. крестиком) во время работы - это просто "свернуть",
  // процесс продолжается в контексте. Сбрасывать прогресс можно только когда
  // всё завершено (или ничего не запускалось).
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeDialog();
      if (phase === 'done') reset();
    }
  };

  const hasAnySource = hasEcomkassa || hasOfd || bankIntegrations.length > 0;
  const canStart = hasAnySource && (!hasEcomkassa || (orderTypes.length > 0 && statuses.length > 0));

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Download" size={20} />
            Дозагрузка исторических данных
          </DialogTitle>
          <DialogDescription>
            Подтянем чеки, счета и операции по счёту за выбранный период из всех
            подключённых интеграций — пригодится, если часть данных не пришла вебхуком.
            Окно можно закрыть — загрузка продолжится в фоне
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
                    selected={dateRange}
                    onSelect={(range) => {
                      if (!range?.from) return;
                      // react-day-picker сбрасывает диапазон до {from, to: undefined}
                      // при начале нового выбора - если хранить это "как есть", то
                      // повторный клик на ТУ ЖЕ дату (period "с X по X") видит в
                      // selected ещё старый to и трактует клик как замену конца
                      // диапазона, а не как его начало, поэтому range.to никогда не
                      // приходит и календарь не закрывается. Всегда пишем то, что
                      // вернул picker, без подмешивания предыдущего to.
                      setDateRange({ from: range.from, to: range.to });
                      if (range.to) {
                        // Обе даты выбраны - период готов, закрываем календарь
                        // сами, не заставляя пользователя тянуться к крестику.
                        setCalendarOpen(false);
                      }
                    }}
                    disabled={{ after: endOfToday() }}
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

            {bankIntegrations.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Icon name="Landmark" size={14} />
                    Деньги — операции по расчётному счёту
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox id="type-money" checked disabled />
                    <Label htmlFor="type-money" className="text-sm font-normal text-muted-foreground">
                      Приходы (in) и расходы (out) за период — загружаются всегда, без фильтра по типу
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Источник: {bankIntegrations.map((b) => b.name).join(', ')}
                  </p>
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
                        <span className="text-muted-foreground">
                          Екомкасса ({ecomkassaIntegrations.map((i) => i.name).join(', ')})
                        </span>
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
                        ОФД ({ofdIntegrations.map((i) => i.name).join(', ')})
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {phase === 'running' ? (
            <>
              <Button variant="outline" onClick={() => closeDialog()} className="w-full sm:w-auto gap-2">
                <Icon name="Minimize2" size={14} />
                Свернуть
              </Button>
              <Button disabled className="w-full sm:flex-1 gap-2">
                <Icon name="Loader2" size={16} className="animate-spin" />
                Загружаем…
              </Button>
            </>
          ) : phase === 'done' ? (
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Готово
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full gap-2"
            >
              <Icon name="Download" size={16} />
              Начать загрузку
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackfillDialog;