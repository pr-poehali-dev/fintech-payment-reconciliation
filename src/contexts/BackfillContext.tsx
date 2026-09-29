import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import functionUrls from '../../backend/func2url.json';

export type BackfillPhase = 'idle' | 'running' | 'done';

export interface BankIntegration {
  id: number;
  name: string;
}

interface EcomkassaProgress {
  processed: number;
  total: number;
  inserted: number;
}

interface BankResult {
  inserted: number;
  total: number;
}

interface StartConfig {
  companyId: number;
  dateFrom: Date;
  dateTo: Date;
  hasEcomkassa: boolean;
  orderTypes: string[];
  statuses: string[];
  hasOfd: boolean;
  bankIntegrations: BankIntegration[];
}

interface BackfillContextValue {
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  reset: () => void;
  phase: BackfillPhase;
  companyId: number | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  ecomkassaProgress: EcomkassaProgress;
  ofdResult: { inserted: number; total: number } | null;
  bankResults: Record<number, BankResult>;
  errors: string[];
  completedTick: number;
  start: (config: StartConfig) => void;
}

const BackfillContext = createContext<BackfillContextValue | undefined>(undefined);

const emptyProgress: EcomkassaProgress = { processed: 0, total: 0, inserted: 0 };

export const BackfillProvider = ({ children }: { children: ReactNode }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [phase, setPhase] = useState<BackfillPhase>('idle');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [ecomkassaProgress, setEcomkassaProgress] = useState<EcomkassaProgress>(emptyProgress);
  const [ofdResult, setOfdResult] = useState<{ inserted: number; total: number } | null>(null);
  const [bankResults, setBankResults] = useState<Record<number, BankResult>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [completedTick, setCompletedTick] = useState(0);

  // Провайдер смонтирован один раз на весь сеанс приложения (в App.tsx, вне
  // Index/страниц) - переключение вкладок внутри /app или закрытие диалога
  // НЕ размонтирует этот компонент, поэтому запущенные ниже async-функции
  // продолжают выполняться и обновлять состояние независимо от того, какая
  // страница отрисована на экране в данный момент.
  const runningRef = useRef(false);

  const runEcomkassaBackfill = useCallback(async (
    companyIdArg: number, from: Date, to: Date, orderTypes: string[], statuses: string[]
  ) => {
    let offset = 0;
    let done = false;
    let totalInserted = 0;
    let matchedTotal = 0;
    // Счётчик подряд идущих неудач на ОДНОМ и том же offset - если запрос
    // не задеплоился/упал по таймауту (напр. 504 от платформы на большой
    // пачке), пробуем этот же offset ещё раз вместо того, чтобы бросать всю
    // дозагрузку - иначе счета (INVC), чей report() медленнее чеков, могли
    // не догрузиться при единичном сетевом сбое.
    let attemptsAtOffset = 0;
    const MAX_ATTEMPTS_PER_OFFSET = 3;

    try {
      while (!done) {
        let res: Response;
        try {
          res = await fetch(functionUrls['ecomkassa-fetch-orders'], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: companyIdArg,
              date_from: from.toISOString(),
              date_to: to.toISOString(),
              order_types: orderTypes,
              statuses,
              offset,
              batch_size: 8
            })
          });
        } catch {
          attemptsAtOffset += 1;
          if (attemptsAtOffset >= MAX_ATTEMPTS_PER_OFFSET) {
            setErrors((prev) => [...prev, 'Екомкасса: сбой сети, попробуйте ещё раз']);
            return;
          }
          continue;
        }

        // Не-JSON/5xx ответ (напр. 504 таймаут от платформы) - тоже повторяем
        // на том же offset, а не считаем это окончательным провалом.
        let data: any;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || !data.success) {
          attemptsAtOffset += 1;
          if (attemptsAtOffset >= MAX_ATTEMPTS_PER_OFFSET) {
            setErrors((prev) => [...prev, data?.error || 'Не удалось загрузить данные из Екомкассы']);
            return;
          }
          continue;
        }

        attemptsAtOffset = 0;
        matchedTotal = data.matched_total;
        totalInserted += data.inserted;
        offset = data.next_offset ?? offset + data.processed;
        done = data.done;

        setEcomkassaProgress({ processed: offset, total: matchedTotal, inserted: totalInserted });
      }
    } catch {
      setErrors((prev) => [...prev, 'Екомкасса: сбой сети, попробуйте ещё раз']);
    }
  }, []);

  const runOfdBackfill = useCallback(async (companyIdArg: number, from: Date, to: Date) => {
    try {
      const res = await fetch(functionUrls['ofd-fetch-receipts'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyIdArg,
          date_from: from.toISOString(),
          date_to: to.toISOString()
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
  }, []);

  const runBankBackfill = useCallback(async (integration: BankIntegration, from: Date, to: Date) => {
    try {
      const res = await fetch(functionUrls['bank-statement-sync'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_id: integration.id,
          date_from: from.toISOString(),
          date_to: to.toISOString()
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
  }, []);

  const start = useCallback((config: StartConfig) => {
    // Запрет параллельного запуска - если процесс уже идёт (даже если диалог
    // сейчас свёрнут/страница не открыта), новый запуск игнорируется.
    if (runningRef.current) return;
    runningRef.current = true;

    setCompanyId(config.companyId);
    setDateFrom(config.dateFrom);
    setDateTo(config.dateTo);
    setEcomkassaProgress(emptyProgress);
    setOfdResult(null);
    setBankResults({});
    setErrors([]);
    setPhase('running');
    setIsDialogOpen(true);

    const tasks: Promise<void>[] = [];
    if (config.hasEcomkassa) {
      tasks.push(runEcomkassaBackfill(config.companyId, config.dateFrom, config.dateTo, config.orderTypes, config.statuses));
    }
    if (config.hasOfd) {
      tasks.push(runOfdBackfill(config.companyId, config.dateFrom, config.dateTo));
    }
    config.bankIntegrations.forEach((bi) => {
      tasks.push(runBankBackfill(bi, config.dateFrom, config.dateTo));
    });

    // .finally здесь гарантированно сработает независимо от того, смонтирован
    // ли сейчас диалог/страница - состояние живёт в этом провайдере, а не в них.
    Promise.all(tasks).finally(() => {
      runningRef.current = false;
      setPhase('done');
      setCompletedTick((t) => t + 1);
    });
  }, [runEcomkassaBackfill, runOfdBackfill, runBankBackfill]);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setPhase('idle');
    setEcomkassaProgress(emptyProgress);
    setOfdResult(null);
    setBankResults({});
    setErrors([]);
    setCompanyId(null);
    setDateFrom(null);
    setDateTo(null);
  }, []);

  return (
    <BackfillContext.Provider
      value={{
        isDialogOpen, openDialog, closeDialog, reset,
        phase, companyId, dateFrom, dateTo,
        ecomkassaProgress, ofdResult, bankResults, errors,
        completedTick, start
      }}
    >
      {children}
    </BackfillContext.Provider>
  );
};

export const useBackfill = () => {
  const ctx = useContext(BackfillContext);
  if (!ctx) throw new Error('useBackfill must be used within BackfillProvider');
  return ctx;
};