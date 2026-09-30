import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { useBackfill } from '@/contexts/BackfillContext';
import { useToast } from '@/hooks/use-toast';
import BackfillPeriodPicker from './backfill/BackfillPeriodPicker';
import BackfillDocTypes from './backfill/BackfillDocTypes';
import BackfillProgress from './backfill/BackfillProgress';
import {
  ActiveSources,
  BACKFILL_STATUSES,
  DOC_TYPES,
  DocType,
  NamedIntegration,
  ecomkassaOrderTypes,
  fetchActiveSources,
  isDocTypeAvailable,
} from './backfill/backfillSources';

interface BackfillDialogProps {
  ecomkassaIntegrations: NamedIntegration[];
  ofdIntegrations: NamedIntegration[];
  bankIntegrations: NamedIntegration[];
}

// Верхняя граница периода - конец СЕГОДНЯШНЕГО дня: ручная дозагрузка
// должна уметь подтянуть и то, что пришло сегодня.
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
// (смонтирован на уровне App.tsx). Свернуть окно не останавливает загрузку.
const BackfillDialog = ({ ecomkassaIntegrations, ofdIntegrations, bankIntegrations }: BackfillDialogProps) => {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const { toast } = useToast();
  const { isDialogOpen, closeDialog, reset, phase, start } = useBackfill();

  const [dateRange, setDateRange] = useState<DateRange>({ from: monthAgo(), to: endOfToday() });
  const dateFrom = dateRange.from ?? monthAgo();
  const dateTo = dateRange.to ?? dateFrom;
  const [docTypes, setDocTypes] = useState<DocType[]>(DOC_TYPES.map((t) => t.id));
  const [isChecking, setIsChecking] = useState(false);

  const sources: ActiveSources = { ecomkassa: ecomkassaIntegrations, ofd: ofdIntegrations, bank: bankIntegrations };
  const hasAnySource = sources.ecomkassa.length > 0 || sources.ofd.length > 0 || sources.bank.length > 0;
  const selectedAvailable = docTypes.filter((t) => isDocTypeAvailable(t, sources));
  const isRunning = phase === 'running';

  const toggleDocType = (id: DocType) => {
    setDocTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleStart = async () => {
    if (!companyId) return;
    setIsChecking(true);
    let fresh: ActiveSources;
    try {
      fresh = await fetchActiveSources(companyId);
    } catch {
      toast({ title: 'Ошибка подключения', description: 'Не удалось проверить интеграции', variant: 'destructive' });
      setIsChecking(false);
      return;
    }
    setIsChecking(false);

    const orderTypes = ecomkassaOrderTypes(docTypes);
    const useEcomkassa = fresh.ecomkassa.length > 0 && orderTypes.length > 0;
    const useOfd = fresh.ofd.length > 0 && docTypes.includes('receipts');
    const banks = docTypes.includes('money') ? fresh.bank : [];

    if (!useEcomkassa && !useOfd && banks.length === 0) {
      toast({
        title: 'Нет активных интеграций',
        description: 'Для выбранных документов нет активной интеграции — проверьте раздел «Интеграции»',
        variant: 'destructive'
      });
      return;
    }

    // Календарь отдаёт даты на полночь - конец периода растягиваем до конца дня.
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    start({
      companyId,
      dateFrom: from,
      dateTo: to,
      hasEcomkassa: useEcomkassa,
      orderTypes,
      statuses: BACKFILL_STATUSES,
      hasOfd: useOfd,
      bankIntegrations: banks,
      ecomkassaNames: fresh.ecomkassa.map((i) => i.name),
      ofdNames: fresh.ofd.map((i) => i.name)
    });
  };

  // Закрытие окна во время работы - это просто "свернуть", процесс
  // продолжается в контексте. Сбрасываем прогресс только после завершения.
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeDialog();
      if (phase === 'done') reset();
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Download" size={20} />
            Дозагрузка исторических данных
          </DialogTitle>
          <DialogDescription>
            Подтянем документы за выбранный период из активных интеграций — пригодится, если часть
            данных не пришла вебхуком. Окно можно закрыть — загрузка продолжится в фоне
          </DialogDescription>
        </DialogHeader>

        {!hasAnySource && phase === 'idle' ? (
          <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-4">
            <Icon name="AlertTriangle" size={20} className="text-muted-foreground shrink-0" />
            <div className="text-sm text-muted-foreground">
              У компании нет активных интеграций с поддержкой дозагрузки (касса Екомкасса, ОФД
              или расчётный счёт) — сначала подключите их в разделе «Интеграции»
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <BackfillPeriodPicker
              dateRange={dateRange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              maxDate={endOfToday()}
              disabled={isRunning}
              onChange={setDateRange}
            />

            <Separator />

            <BackfillDocTypes selected={docTypes} sources={sources} disabled={isRunning} onToggle={toggleDocType} />

            {phase !== 'idle' && (
              <>
                <Separator />
                <BackfillProgress />
              </>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isRunning ? (
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
              disabled={!hasAnySource || selectedAvailable.length === 0 || isChecking}
              className="w-full gap-2"
            >
              <Icon name={isChecking ? 'Loader2' : 'Download'} size={16} className={isChecking ? 'animate-spin' : ''} />
              {isChecking ? 'Проверяем интеграции…' : 'Начать загрузку'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackfillDialog;
