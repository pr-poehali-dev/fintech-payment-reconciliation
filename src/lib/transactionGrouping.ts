import { Transaction, TransactionType } from '@/components/transactions/transactionsTypes';

export interface TransactionGroup {
  id: string;
  items: Transaction[];
}

// Уникальный ключ записи: связи типа "чек ОФД" -> "чек кассы" и "чек кассы" ->
// "чек ОФД" используют одинаковые source ('ofd'/'ecomkassa'), поэтому пара
// (type, source, id) однозначно адресует любую строку транзакции.
export const nodeKey = (t: Pick<Transaction, 'type' | 'source' | 'id'>) => `${t.type}:${t.source}:${t.id}`;

/**
 * Группирует плоский список транзакций в связанные цепочки (платёж -> чек
 * кассы -> чек ОФД) через систему непересекающихся множеств (union-find).
 * Бэкенд размечает связь только в одну сторону от каждой записи (платёж
 * знает про свой чек, чек ОФД и чек кассы знают друг про друга по
 * фискальным реквизитам) - этого достаточно: если хотя бы одна из двух
 * записей объявляет связь, они попадают в одну группу, а транзитивность
 * union-find сама достраивает цепочку из 3 документов.
 */
export const groupTransactions = (transactions: Transaction[]): TransactionGroup[] => {
  const byKey = new Map(transactions.map((t) => [nodeKey(t), t]));
  const parent = new Map<string, string>();

  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  transactions.forEach((t) => {
    const a = nodeKey(t);
    find(a);
    if (t.linked_id && t.linked_type && t.linked_source) {
      const b = `${t.linked_type}:${t.linked_source}:${t.linked_id}`;
      if (byKey.has(b)) union(a, b);
    }
  });

  const groupsMap = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    const root = find(nodeKey(t));
    if (!groupsMap.has(root)) groupsMap.set(root, []);
    (groupsMap.get(root) as Transaction[]).push(t);
  });

  const typeOrder: Record<string, number> = { payment: 0, receipt: 1, money: 2 };

  return Array.from(groupsMap.entries())
    .map(([id, items]) => ({
      id,
      items: [...items].sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9))
    }))
    .sort((a, b) => {
      const latest = (items: Transaction[]) =>
        Math.max(...items.map((i) => (i.occurred_at ? new Date(i.occurred_at).getTime() : 0)));
      return latest(b.items) - latest(a.items);
    });
};

/** Множество ключей записей, у которых есть пара (связь считается по группе, а не по одностороннему полю linked_id одной записи). */
export const computeMatchedKeys = (transactions: Transaction[]): Set<string> => {
  const groups = groupTransactions(transactions);
  const keys = new Set<string>();
  groups.forEach((g) => {
    if (g.items.length > 1) {
      g.items.forEach((item) => keys.add(nodeKey(item)));
    }
  });
  return keys;
};

/** Сколько записей каждого типа реально входят в связанную пару/цепочку (а не просто "линк на себя же самого"). */
export const computeMatchedCounts = (
  transactions: Transaction[]
): Partial<Record<TransactionType, number>> => {
  const groups = groupTransactions(transactions);
  const counts: Partial<Record<TransactionType, number>> = {};
  groups.forEach((g) => {
    if (g.items.length > 1) {
      g.items.forEach((item) => {
        counts[item.type] = (counts[item.type] || 0) + 1;
      });
    }
  });
  return counts;
};