// Типы операций фискального документа (тег 1054, 54-ФЗ), как их возвращает
// API ОФД.ру (receipts-with-fpd-short): Income, Refund income, Expense,
// Refund expense. Показываем пользователю сразу на русском - так понятнее,
// чем сырые английские значения из ответа ОФД.
const OFD_OPERATION_TYPE_LABELS: Record<string, string> = {
  income: 'Приход',
  'refund income': 'Возврат прихода',
  expense: 'Расход',
  'refund expense': 'Возврат расхода',
};

export const ofdOperationTypeLabel = (raw: string | null): string => {
  if (!raw) return '—';
  const key = raw.trim().toLowerCase();
  return OFD_OPERATION_TYPE_LABELS[key] || raw;
};

// Приход и возврат расхода - деньги остаются у компании (зелёный).
// Возврат прихода и расход - деньги уходят обратно (жёлтый/предупреждение).
export const ofdOperationTypeColorClass = (raw: string | null): string => {
  if (!raw) return 'bg-muted-foreground';
  const key = raw.trim().toLowerCase();
  if (key === 'income' || key === 'refund expense') return 'bg-success';
  if (key === 'refund income' || key === 'expense') return 'bg-warning';
  return 'bg-muted-foreground';
};
