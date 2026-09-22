import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ReconciliationPeriodPicker from '@/components/reconciliation/ReconciliationPeriodPicker';
import ReconciliationTiles from '@/components/reconciliation/ReconciliationTiles';
import ReconciliationChart from '@/components/reconciliation/ReconciliationChart';
import functionUrls from '../../backend/func2url.json';

interface ReconciliationTotals {
  payments: { amount: number; count: number };
  receipts: { amount: number; count: number };
  bank: { amount: number; raw_amount: number; commission_amount: number; count: number };
}

interface DailyPoint {
  date: string;
  payments: number;
  receipts: number;
  bank: number;
}

interface ReconciliationResponse {
  success: boolean;
  totals: ReconciliationTotals;
  daily: DailyPoint[];
  details: {
    bank_commission_note: string | null;
  };
}

const toDateParam = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDefaultFrom = () => {
  const d = getYesterday();
  d.setDate(d.getDate() - 6);
  return d;
};

const ReconciliationPage = () => {
  const [dateFrom, setDateFrom] = useState<Date>(getDefaultFrom());
  const [dateTo, setDateTo] = useState<Date>(getYesterday());
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        company_id: String(companyId),
        date_from: toDateParam(dateFrom),
        date_to: toDateParam(dateTo)
      });
      const response = await fetch(`${functionUrls['reconciliation-stats']}?${params.toString()}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setData(result);
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: result.error || 'Не удалось загрузить данные сверки',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        description: 'Проверьте интернет-соединение',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, dateFrom, dateTo, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handlePeriodChange = (from: Date, to: Date) => {
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Сверка</h2>
          <p className="text-muted-foreground">
            Автоматическая сверка платежей, чеков и поступлений на расчётный счёт
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" disabled={isLoading}>
          <Icon name="RefreshCw" size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <ReconciliationPeriodPicker dateFrom={dateFrom} dateTo={dateTo} onChange={handlePeriodChange} />

      {isLoading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
            <p className="text-muted-foreground">Считаем сверку...</p>
          </div>
        </div>
      ) : data ? (
        <>
          <ReconciliationTiles totals={data.totals} />
          <ReconciliationChart daily={data.daily} />
          {data.details.bank_commission_note && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              <Icon name="Info" size={16} className="mt-0.5 shrink-0" />
              <p>{data.details.bank_commission_note}</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default ReconciliationPage;
