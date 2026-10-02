import { Transaction } from '@/components/transactions/transactionsTypes';

export type LinkReasonKind = 'manual' | 'order' | 'fiscal' | 'bank' | 'group' | 'crm';

export interface LinkReason {
  kind: LinkReasonKind;
  label: string;
  description: string;
  icon: string;
}

const autoReasons: Record<string, Omit<LinkReason, 'kind'> & { kind: LinkReasonKind }> = {
  receipt_id: { kind: 'order', label: 'По номеру заказа', description: 'Чек привязан к платежу при обработке уведомления шлюза Екомкассы', icon: 'Hash' },
  order_id: { kind: 'order', label: 'По номеру заказа', description: 'Совпал номер заказа / внешний ID платежа и чека', icon: 'Hash' },
  automation: { kind: 'order', label: 'Сценарий автоматизации', description: 'Документ создан сценарием автоматизации по этому платежу (связь по номеру заказа в кассе)', icon: 'Workflow' },
  order_receipt: { kind: 'order', label: 'Закрытие заказа', description: 'Чек пробит кассой при завершении этого заказа', icon: 'Truck' },
  refund_receipt: { kind: 'order', label: 'Возврат по платежу', description: 'Чек возврата пробит по этому платежу (совпал номер платежа)', icon: 'Undo2' },
  fiscal_triplet: { kind: 'fiscal', label: 'По фискальным данным', description: 'Совпали фискальные реквизиты: ФН + номер ФД + ФПД', icon: 'FileCheck' },
  qr_id: { kind: 'bank', label: 'Банковская операция', description: 'В назначении платежа банка найден тот же QR ID СБП, что у платежа', icon: 'Landmark' },
  external_id: { kind: 'bank', label: 'Банковская операция', description: 'В назначении платежа банка найден внешний ID платежа', icon: 'Landmark' },
  acquiring_commission: { kind: 'bank', label: 'Банковская операция', description: 'Комиссия банка, удержанная из этого зачисления', icon: 'Landmark' },
  crm_automation: { kind: 'crm', label: 'Заказ по сделке', description: 'Заказ создан сценарием автоматизации по этой сделке CRM (связь по UUID заказа)', icon: 'Workflow' },
  crm_email: { kind: 'crm', label: 'По почте, сумме и времени', description: 'У сделки и чека совпали почта покупателя и сумма, чек пробит в период работы со сделкой', icon: 'Briefcase' },
  settlement_date: { kind: 'bank', label: 'Банковская операция', description: 'Зачисление эквайринга, сопоставленное с платежом при загрузке выписки', icon: 'Landmark' },
};

const manualReason: LinkReason = {
  kind: 'manual',
  label: 'Вручную',
  description: 'Запись добавлена в группу вручную',
  icon: 'Hand',
};

const sameNode = (t: Transaction, type: string | null, source: string | null, id: number | null) =>
  t.type === type && t.source === source && t.id === id;

/**
 * Реальная причина, по которой запись item находится в группе groupItems.
 * Сначала ищем автоматическую связь (исходящую от item к участнику группы
 * либо входящую от участника к item) - её match_method и есть причина.
 * Если автоматической связи нет, а у записи есть ручная группа - "Вручную".
 */
export const getLinkReason = (item: Transaction, groupItems: Transaction[]): LinkReason => {
  const others = groupItems.filter((g) => !(g.type === item.type && g.source === item.source && g.id === item.id));

  let method: string | null = null;
  if (item.linked_id && others.some((o) => sameNode(o, item.linked_type, item.linked_source, item.linked_id))) {
    method = item.match_method;
  }
  if (!method) {
    const incoming = others.find((o) => o.linked_id && sameNode(item, o.linked_type, o.linked_source, o.linked_id));
    if (incoming) method = incoming.match_method;
  }

  const auto = method ? autoReasons[method] : undefined;
  if (auto) return auto;
  if (item.manual_group_id) return manualReason;
  if (item.type === 'money') {
    return { kind: 'bank', label: 'Банковская операция', description: 'Операция по счёту, связанная с участниками группы', icon: 'Landmark' };
  }
  return { kind: 'group', label: 'Связано в группе', description: 'Связано через другие записи этой группы', icon: 'Link' };
};

export const linkReasonClassName: Record<LinkReasonKind, string> = {
  manual: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  order: 'bg-primary/10 text-primary border-primary/30',
  fiscal: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  bank: 'bg-success/10 text-success border-success/30',
  group: 'bg-muted text-muted-foreground border-border',
  crm: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};