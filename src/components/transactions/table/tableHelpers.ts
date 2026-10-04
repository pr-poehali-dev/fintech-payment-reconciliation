import { ofdOperationTypeLabel, ofdOperationTypeColorClass } from '@/lib/ofdOperationType';
import { transactionStatusLabel, transactionStatusColor } from '@/lib/transactionStatus';

export const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt_kassa: { icon: 'Receipt', label: 'Чек кассы', className: 'bg-info/10 text-info border-info/30' },
  receipt_order: { icon: 'Truck', label: 'Заказ', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  receipt_ofd: { icon: 'FileCheck', label: 'Чек ОФД', className: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
  crm_deal: { icon: 'Briefcase', label: 'Сделка CRM', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

// Единая точка получения цвета/подписи статуса с учётом типа транзакции -
// у чека ОФД status это OperationType (54-ФЗ, свой словарь), у остальных -
// обычный статус платежа/кассы (см. lib/transactionStatus.ts).
export const getStatusDisplay = (tx: { type: string; status: string | null }) => {
  if (tx.type === 'receipt_ofd') {
    return { label: ofdOperationTypeLabel(tx.status), color: ofdOperationTypeColorClass(tx.status) };
  }
  if (tx.type === 'crm_deal') {
    if (tx.status === 'wait') return { label: 'Заказ в работе', color: 'bg-info' };
    return { label: 'Оплачена', color: 'bg-success' };
  }
  if (tx.type === 'receipt_order') {
    if (tx.status === 'wait') return { label: 'Ожидает доставки', color: 'bg-info' };
    if (tx.status === 'done') return { label: 'Выполнен', color: 'bg-success' };
  }
  return { label: transactionStatusLabel(tx.status), color: transactionStatusColor(tx.status) };
};

export const formatAmount = (amount: number | null) => {
  if (amount === null) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    signDisplay: 'exceptZero'
  }).format(amount);
};

export const rowClassName = (isSelected: boolean) =>
  `group cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`;
