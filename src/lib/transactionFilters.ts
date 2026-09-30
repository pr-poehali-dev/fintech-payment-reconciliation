import { Transaction } from '@/components/transactions/transactionsTypes';
import { DateFilter } from '@/components/transactions/TransactionsFilters';
import { nodeKey } from '@/lib/transactionGrouping';

// "2 500", "2500,00", "-14 ₽", "+1 000.50 руб" -> { value, raw }. Не число -> null.
export const parseAmountQuery = (query: string): { value: number; raw: string } | null => {
  const cleaned = query
    .trim()
    .replace(/(₽|руб\.?|р\.?)$/i, '')
    .replace(/[\s\u00a0]/g, '')
    .replace(/^[+-]/, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return { value: Number(cleaned), raw: cleaned };
};

interface FilterParams {
  matchedKeys: Set<string>;
  showUnmatchedOnly: boolean;
  dateFilter: DateFilter | null;
  searchQuery: string;
}

export const filterTransactions = (
  transactions: Transaction[],
  { matchedKeys, showUnmatchedOnly, dateFilter, searchQuery }: FilterParams
): Transaction[] =>
  transactions.filter((tx) => {
    if (showUnmatchedOnly && matchedKeys.has(nodeKey(tx))) return false;

    // Фильтр по дате - по календарному дню операции (включительно оба конца).
    if (dateFilter) {
      if (!tx.occurred_at) return false;
      const day = new Date(tx.occurred_at);
      day.setHours(0, 0, 0, 0);
      const from = new Date(dateFilter.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateFilter.to);
      to.setHours(0, 0, 0, 0);
      if (day < from || day > to) return false;
    }

    if (!searchQuery.trim()) return true;

    // Запрос похож на число ("14", "2 500", "2420,00", "-14 ₽") - ищем ТОЧНОЕ
    // совпадение суммы (без учёта знака) или точный номер документа/платежа.
    // Раньше число искалось как подстрока по всему тексту, и "14" находило
    // любые записи, где эти цифры встречались в QR-коде, дате или номере.
    const numeric = parseAmountQuery(searchQuery);
    if (numeric !== null) {
      const amountMatches = Math.abs(Math.abs(Number(tx.amount) || 0) - numeric.value) < 0.005;
      const docNumber = (tx.title || '').match(/#\s*(\S+)/)?.[1];
      const numberMatches = numeric.raw === docNumber || numeric.raw === String(tx.reference ?? '');
      return amountMatches || numberMatches;
    }

    const query = searchQuery.toLowerCase();
    const haystack = [
      tx.title,
      tx.subtitle,
      tx.integration_name,
      tx.reference,
      tx.status,
      tx.amount?.toString()
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
