// Статус ПРОБИТИЯ чека в ФНС (тег FnsStatus), как его возвращает API ОФД.ру
// (receipts-with-fpd-short) - в отличие от OperationType (см. ofdOperationType.ts),
// который описывает тип документа (приход/расход), FnsStatus отвечает на
// вопрос "успешно ли чек дошёл и зарегистрировался в налоговой" - это и есть
// то, что имеет смысл показывать как "Статус" в ленте событий и деталях чека.
const OFD_FNS_STATUS_LABELS: Record<string, string> = {
  success: 'Пробит в ФНС',
  fail: 'Ошибка пробития',
  wait: 'Ожидает пробития',
};

export const ofdFnsStatusLabel = (raw: string | null): string => {
  if (!raw) return '—';
  const key = raw.trim().toLowerCase();
  return OFD_FNS_STATUS_LABELS[key] || raw;
};

export const ofdFnsStatusColorClass = (raw: string | null): string => {
  if (!raw) return 'bg-muted-foreground';
  const key = raw.trim().toLowerCase();
  if (key === 'success') return 'bg-success';
  if (key === 'fail') return 'bg-destructive';
  if (key === 'wait') return 'bg-warning';
  return 'bg-muted-foreground';
};
