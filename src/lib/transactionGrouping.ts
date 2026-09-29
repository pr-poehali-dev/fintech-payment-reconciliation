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
  // Итоговая сумма группы - НЕ простая сумма signed_amount всех строк (это
  // утроило бы счёт: платёж, его чек кассы и чек ОФД - это один и тот же
  // факт движения денег, показанный трижды тремя источниками). Вместо этого
  // сумма считается по каждой РЕАЛЬНОЙ сделке внутри группы один раз - см.
  // computeGroupTotal ниже.
  totalAmount: number;
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
const makeUnionFind = () => {
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

  return { find, union };
};

// Порядок отображения "главной" (верхнеуровневой) строки группы в свёрнутом
// виде: всегда либо ЗАКАЗ (receipt_order), либо ПЛАТЁЖ (payment), если
// заказа нет - заказ приоритетнее, т.к. внутри него уже может быть свой
// платёж, чек кассы, чек ОФД, деньги на счёт и т.д. Чек кассы/ОФД и
// банковская операция сами по себе никогда не показываются как верхний
// уровень группы - они всегда вложены (под заказом либо платежом).
const displayOrder: Record<string, number> = { receipt_order: 0, payment: 1, receipt_kassa: 2, receipt_ofd: 3, money: 4 };

// Порядок предпочтения при выборе "представителя" сделки для СУММЫ группы -
// платёж остаётся самым авторитетным источником факта движения денег
// (это его amount реально был авторизован/подтверждён платёжной системой),
// затем заказ/чек кассы, затем чек ОФД, затем банковская операция. Отдельно
// от displayOrder, т.к. это про выбор суммы, а не про то, что показывается
// свёрнутой шапкой группы.
const sumRepresentativeOrder: Record<string, number> = { payment: 0, receipt_order: 1, receipt_kassa: 1, receipt_ofd: 2, money: 3 };

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

  // Первый (авто-only) union-find - только по linked_id, БЕЗ ручных связей.
  // Каждый его корень - это одна физическая "сделка" (платёж + его чек кассы
  // + его чек ОФД - все три источника про ОДНО и то же движение денег).
  // Нужен отдельно от финального группирования, чтобы при ручной склейке
  // (см. ниже) не просуммировать одну и ту же сделку несколько раз и не
  // потерять вторую сделку, если пользователь вручную соединил, например,
  // продажу с отдельным возвратом.
  const autoUF = makeUnionFind();
  transactions.forEach((t) => {
    const a = nodeKey(t);
    autoUF.find(a);
    if (t.linked_id && t.linked_type && t.linked_source) {
      const b = `${t.linked_type}:${t.linked_source}:${t.linked_id}`;
      if (byKey.has(b)) autoUF.union(a, b);
    }
  });

  // Финальный union-find - начинается от тех же авто-связей, затем поверх
  // накладывается ручная связка пользователя (кнопка "Связать"): все
  // транзакции с одинаковым manual_group_id объединяются в одну группу,
  // транзитивность union-find сама достроит цепочку, если ручная и
  // автоматическая связи пересекаются.
  const finalUF = makeUnionFind();
  transactions.forEach((t) => {
    const a = nodeKey(t);
    finalUF.find(a);
    if (t.linked_id && t.linked_type && t.linked_source) {
      const b = `${t.linked_type}:${t.linked_source}:${t.linked_id}`;
      if (byKey.has(b)) finalUF.union(a, b);
    }
  });
  const byManualGroup = new Map<string, string[]>();
  transactions.forEach((t) => {
    if (!t.manual_group_id) return;
    const list = byManualGroup.get(t.manual_group_id) ?? [];
    list.push(nodeKey(t));
    byManualGroup.set(t.manual_group_id, list);
  });
  byManualGroup.forEach((keys) => {
    for (let i = 1; i < keys.length; i++) finalUF.union(keys[0], keys[i]);
  });

  const groupsMap = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    const root = finalUF.find(nodeKey(t));
    if (!groupsMap.has(root)) groupsMap.set(root, []);
    (groupsMap.get(root) as Transaction[]).push(t);
  });

  const computeStatus = (items: Transaction[]): { status: GroupStatus; isManual: boolean } => {
    const isManual = items.some((i) => i.manual_group_id);
    if (items.length <= 1) return { status: 'unmatched', isManual: false };
    const hasPayment = items.some((i) => i.type === 'payment');
    const hasReceipt = items.some((i) => i.type === 'receipt_kassa' || i.type === 'receipt_ofd' || i.type === 'receipt_order');
    if (hasPayment && hasReceipt) return { status: 'reconciled', isManual };
    if (isManual) return { status: 'manual', isManual: true };
    return { status: 'matched', isManual: false };
  };

  // Сумма группы = сумма ПО КАЖДОЙ РЕАЛЬНОЙ СДЕЛКЕ внутри группы один раз,
  // а не сумма всех строк. Иначе один и тот же факт движения денег,
  // отражённый в 2-3 источниках (платёж + чек кассы + чек ОФД), утроил бы
  // итог. Сделки внутри группы различаются по корню авто-union-find -
  // для каждой такой подгруппы берём signed_amount одного представителя
  // (по typeOrder) и суммируем представителей.
  const computeTotal = (items: Transaction[]): number => {
    const byDeal = new Map<string, Transaction[]>();
    items.forEach((t) => {
      const dealRoot = autoUF.find(nodeKey(t));
      const list = byDeal.get(dealRoot) ?? [];
      list.push(t);
      byDeal.set(dealRoot, list);
    });
    let total = 0;
    byDeal.forEach((dealItems) => {
      const representative = [...dealItems].sort((a, b) => (sumRepresentativeOrder[a.type] ?? 9) - (sumRepresentativeOrder[b.type] ?? 9))[0];
      total += representative.signed_amount ?? representative.amount ?? 0;
    });
    return total;
  };

  return Array.from(groupsMap.entries())
    .map(([id, items]) => {
      const { status, isManual } = computeStatus(items);
      return {
        id,
        items: [...items].sort((a, b) => (displayOrder[a.type] ?? 9) - (displayOrder[b.type] ?? 9)),
        status,
        isManual,
        totalAmount: computeTotal(items)
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