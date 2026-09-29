import { Transaction, TransactionType } from '@/components/transactions/transactionsTypes';

// Статус группы для отображения в реестре:
// - 'reconciled' ("Сверено") - в группе есть и платёж, и хотя бы один чек
//   (кассы/ОФД/заказ) - это и есть база 54-ФЗ: деньги оплачены и чек пробит;
// - 'matched' ("Связано") - есть автоматическая связь, но платежа в группе
//   нет (например, пара "чек кассы + чек ОФД" без платежа);
// - 'manual' ("Связано вручную") - группа существует только благодаря явной
//   связке пользователем (кнопка "Связать"), без единой автоматической
//   пары внутри - т.е. хотя бы одна пара в группе соединена ТОЛЬКО общим
//   manual_group_id, а не linked_id;
// - 'unmatched' ("Нет пары") - запись одна, без связей.
export type GroupStatus = 'reconciled' | 'matched' | 'manual' | 'unmatched';

export interface TransactionGroup {
  id: string;
  items: Transaction[];
  status: GroupStatus;
  isManual: boolean;
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

  // Автоматическая связь (по linked_id, размечается бэкендом при совпадении
  // фискальных реквизитов/receipt_id).
  transactions.forEach((t) => {
    const a = nodeKey(t);
    find(a);
    if (t.linked_id && t.linked_type && t.linked_source) {
      const b = `${t.linked_type}:${t.linked_source}:${t.linked_id}`;
      if (byKey.has(b)) union(a, b);
    }
  });

  // Ручная связь пользователя (кнопка "Связать") - все транзакции с
  // одинаковым manual_group_id объединяются в ту же группу, что и
  // автоматические связи, транзитивность union-find сама достроит цепочку,
  // если ручная и автоматическая связи пересекаются.
  const byManualGroup = new Map<string, string[]>();
  transactions.forEach((t) => {
    if (!t.manual_group_id) return;
    const list = byManualGroup.get(t.manual_group_id) ?? [];
    list.push(nodeKey(t));
    byManualGroup.set(t.manual_group_id, list);
  });
  byManualGroup.forEach((keys) => {
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
  });

  const groupsMap = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    const root = find(nodeKey(t));
    if (!groupsMap.has(root)) groupsMap.set(root, []);
    (groupsMap.get(root) as Transaction[]).push(t);
  });

  const typeOrder: Record<string, number> = { payment: 0, receipt_kassa: 1, receipt_order: 1, receipt_ofd: 2, money: 3 };

  const computeStatus = (items: Transaction[]): { status: GroupStatus; isManual: boolean } => {
    const isManual = items.some((i) => i.manual_group_id);
    if (items.length <= 1) return { status: 'unmatched', isManual: false };
    const hasPayment = items.some((i) => i.type === 'payment');
    const hasReceipt = items.some((i) => i.type === 'receipt_kassa' || i.type === 'receipt_ofd' || i.type === 'receipt_order');
    if (hasPayment && hasReceipt) return { status: 'reconciled', isManual };
    if (isManual) return { status: 'manual', isManual: true };
    return { status: 'matched', isManual: false };
  };

  return Array.from(groupsMap.entries())
    .map(([id, items]) => {
      const { status, isManual } = computeStatus(items);
      return {
        id,
        items: [...items].sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)),
        status,
        isManual
      };
    })
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