import { useState, useEffect, useCallback } from 'react';
import functionUrls from '../../../backend/func2url.json';

interface DashboardStats {
  totalPayments: number;
  successfulPayments: number;
  paymentsRevenue: number;
  totalReceipts: number;
  receiptsSum: number;
  activeIntegrations: number;
}

const EMPTY_STATS: DashboardStats = {
  totalPayments: 0,
  successfulPayments: 0,
  paymentsRevenue: 0,
  totalReceipts: 0,
  receiptsSum: 0,
  activeIntegrations: 0
};

export const useDashboardStats = (companyId: number | undefined) => {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboardStats = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const [paymentsRes, transactionsRes, integrationsRes] = await Promise.all([
        fetch(`${functionUrls['payments-list']}?company_id=${companyId}&limit=1000&offset=0`),
        fetch(`${functionUrls['transactions-list']}?company_id=${companyId}&type=receipt&limit=1000&offset=0`),
        fetch(`${functionUrls['integrations-list']}?company_id=${companyId}`)
      ]);

      const [paymentsData, transactionsData, integrationsData] = await Promise.all([
        paymentsRes.json(),
        transactionsRes.json(),
        integrationsRes.json()
      ]);

      const rawPayments = paymentsData.payments || [];
      const receipts = transactionsData.transactions || [];
      const integrations = integrationsData.user_integrations || [];

      // По одному платежу может прийти несколько вебхуков подряд (например,
      // "Авторизован" -> "Подтверждён" -> "Возврат") - каждый сохраняется
      // отдельной строкой в webhook_payments. Чтобы не засчитать один и тот же
      // платёж несколько раз, берём только последнее по времени состояние
      // каждого payment_id (список отсортирован от новых к старым).
      const latestByPaymentId = new Map<string, any>();
      for (const p of rawPayments) {
        if (!latestByPaymentId.has(p.payment_id)) {
          latestByPaymentId.set(p.payment_id, p);
        }
      }
      const payments = Array.from(latestByPaymentId.values());

      const successfulPayments = payments.filter((p: any) =>
        p.status === 'AUTHORIZED' || p.status === 'CONFIRMED'
      );

      const paymentsRevenue = successfulPayments.reduce((sum: number, p: any) =>
        sum + (p.amount || 0), 0
      );

      const receiptsSum = receipts.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      const activeIntegrations = integrations.filter((i: any) => i.status === 'active').length;

      setStats({
        totalPayments: payments.length,
        successfulPayments: successfulPayments.length,
        paymentsRevenue,
        totalReceipts: receipts.length,
        receiptsSum,
        activeIntegrations
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  return { stats, isLoading, reload: loadDashboardStats };
};