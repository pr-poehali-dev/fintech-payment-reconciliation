// Статусы платежей/чеков кассы (не ОФД - у него отдельный словарь, см.
// ofdOperationType.ts) переводим на русский - в исходных данных это
// технические коды платёжной системы/кассы Екомкассы.
const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Оплачено',
  done: 'Создан',
  AUTHORIZED: 'Авторизован',
  REJECTED: 'Отклонён',
  fail: 'Ошибка',
  REFUNDED: 'Возврат',
  CANCELED: 'Отменён'
};

export const transactionStatusLabel = (status: string | null): string => {
  if (!status) return '—';
  return STATUS_LABELS[status] || status;
};

export const transactionStatusColor = (status: string | null): string => {
  switch (status) {
    case 'CONFIRMED':
    case 'done':
    case 'in':
      return 'bg-success';
    case 'AUTHORIZED':
      return 'bg-info';
    case 'REJECTED':
    case 'fail':
      return 'bg-destructive';
    case 'REFUNDED':
    case 'out':
      return 'bg-warning';
    case 'CANCELED':
      return 'bg-muted-foreground';
    default:
      return 'bg-muted-foreground';
  }
};
