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
      const [paymentsRes, receiptsRes, integrationsRes] = await Promise.all([
        fetch(`${functionUrls['payments-list']}?company_id=${companyId}&limit=1000&offset=0`),
        fetch(`${functionUrls['receipts-list']}?company_id=${companyId}&limit=1000&offset=0`),
        fetch(`${functionUrls['integrations-list']}?company_id=${companyId}`)
      ]);

      const [paymentsData, receiptsData, integrationsData] = await Promise.all([
        paymentsRes.json(),
        receiptsRes.json(),
        integrationsRes.json()
      ]);

      const payments = paymentsData.payments || [];
      const receipts = receiptsData.receipts || [];
      const integrations = integrationsData.user_integrations || [];

      const successfulPayments = payments.filter((p: any) =>
        p.status === 'AUTHORIZED' || p.status === 'CONFIRMED'
      );

      const paymentsRevenue = successfulPayments.reduce((sum: number, p: any) =>
        sum + (p.amount || 0), 0
      );

      const receiptsSum = receipts.reduce((sum: number, r: any) => sum + (r.total_sum || 0), 0);
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
