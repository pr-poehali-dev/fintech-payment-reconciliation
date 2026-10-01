import { Company } from '@/contexts/AuthContext';

export const SUBSCRIPTION_STATUS: Record<string, { label: string; className: string }> = {
  trial: { label: 'Пробный период', className: 'bg-info/15 text-info border-info/30' },
  active: { label: 'Активна', className: 'bg-success/15 text-success border-success/30' },
  past_due: { label: 'Ожидает оплаты', className: 'bg-warning/15 text-warning border-warning/30' },
  canceled: { label: 'Отменена', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  expired: { label: 'Истекла', className: 'bg-destructive/15 text-destructive border-destructive/30' }
};

export const subscriptionEndDate = (company: Company | null) =>
  company?.subscription_status === 'trial' ? company?.trial_ends_at : company?.current_period_end;

export const daysLeft = (iso?: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

export const formatLongDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export const formatShortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';