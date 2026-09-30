export interface ActionTemplateRow {
  id: number;
  code: string;
  action_type: 'create_receipt' | 'create_order';
  name: string;
  description: string | null;
  operation: string;
  paid: boolean;
  is_active: boolean;
  sort_order: number;
  provider_id: number | null;
  provider_name: string | null;
  protocol_version: string;
  receipt_type: string;
  payment_method: string;
  payment_object: string;
  measure: string;
  payment_type: number | null;
  default_email: string | null;
  scenarios_count: number;
}

export interface ActionTemplateForm {
  code: string;
  action_type: 'create_receipt' | 'create_order';
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  provider_id: number | null;
  protocol_version: string;
  receipt_type: string;
  operation: string;
  payment_method: string;
  payment_object: string;
  measure: string;
  payment_type: string;
  default_email: string;
}

export interface CashProvider {
  id: number;
  name: string;
}

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export const ACTION_TYPE_OPTIONS = [
  { value: 'create_receipt', label: 'Создать чек', icon: 'Receipt' },
  { value: 'create_order', label: 'Создать заказ', icon: 'Truck' }
] as const;

export const PROTOCOL_OPTIONS: Option[] = [
  { value: 'v4', label: 'v4', hint: 'ФФД 1.05' },
  { value: 'v5', label: 'v5', hint: 'ФФД 1.2' }
];

export const RECEIPT_TYPE_OPTIONS: Option[] = [
  { value: 'regular', label: 'Обычный' },
  { value: 'correction', label: 'Коррекция' }
];

export const OPERATION_OPTIONS: Option[] = [
  { value: 'sell', label: 'Приход' },
  { value: 'sell_refund', label: 'Возврат прихода' }
];

// Тег 1214 АТОЛ Онлайн v4/v5.
export const PAYMENT_METHOD_OPTIONS: Option[] = [
  { value: 'full_prepayment', label: 'Предоплата 100%', hint: 'full_prepayment' },
  { value: 'prepayment', label: 'Предоплата', hint: 'prepayment' },
  { value: 'advance', label: 'Аванс', hint: 'advance' },
  { value: 'full_payment', label: 'Полный расчёт', hint: 'full_payment' },
  { value: 'partial_payment', label: 'Частичный расчёт и кредит', hint: 'partial_payment' },
  { value: 'credit', label: 'Передача в кредит', hint: 'credit' },
  { value: 'credit_payment', label: 'Оплата кредита', hint: 'credit_payment' }
];

// Тег 1212: v4 — строка, v5 — число.
export const PAYMENT_OBJECT_OPTIONS: Option[] = [
  { value: 'commodity', label: 'Товар', hint: 'v4 commodity · v5 1' },
  { value: 'commodity_marked', label: 'Маркированный товар', hint: 'v4 commodity · v5 33' },
  { value: 'service', label: 'Услуга', hint: 'v4 service · v5 4' },
  { value: 'job', label: 'Работа', hint: 'v4 job · v5 3' },
  { value: 'payment', label: 'Аванс', hint: 'v4 payment · v5 10' }
];

// v4 — measurement_unit (строка), v5 — measure (тег 2108).
export const MEASURE_OPTIONS: Option[] = [
  { value: 'piece', label: 'Штука', hint: 'v4 шт · v5 0' },
  { value: 'gram', label: 'Граммы', hint: 'v4 г · v5 10' },
  { value: 'kilogram', label: 'Килограммы', hint: 'v4 кг · v5 11' },
  { value: 'day', label: 'Сутки', hint: 'v4 сут · v5 70' }
];

export const NO_PAYMENT = 'none';

// payments[].type: пусто — документ без оплаты.
export const PAYMENT_TYPE_OPTIONS: Option[] = [
  { value: NO_PAYMENT, label: 'Пусто', hint: 'без оплаты' },
  { value: '0', label: 'Наличные', hint: 'type 0' },
  { value: '1', label: 'Безнал', hint: 'type 1' },
  { value: '2', label: 'Аванс', hint: 'type 2 · зачёт предоплаты' }
];

export const EMPTY_TEMPLATE: ActionTemplateForm = {
  code: '',
  action_type: 'create_order',
  name: '',
  description: '',
  is_active: true,
  sort_order: 100,
  provider_id: null,
  protocol_version: 'v4',
  receipt_type: 'regular',
  operation: 'sell',
  payment_method: 'full_payment',
  payment_object: 'commodity',
  measure: 'piece',
  payment_type: '1',
  default_email: ''
};

export const labelOf = (options: Option[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label || value || '—';

export const templateToForm = (t: ActionTemplateRow): ActionTemplateForm => ({
  code: t.code,
  action_type: t.action_type,
  name: t.name,
  description: t.description || '',
  is_active: t.is_active,
  sort_order: t.sort_order,
  provider_id: t.provider_id,
  protocol_version: t.protocol_version,
  receipt_type: t.receipt_type,
  operation: t.operation,
  payment_method: t.payment_method,
  payment_object: t.payment_object,
  measure: t.measure,
  payment_type: t.payment_type === null ? NO_PAYMENT : String(t.payment_type),
  default_email: t.default_email || ''
});

export const formToPayload = (f: ActionTemplateForm) => ({
  ...f,
  payment_type: f.payment_type === NO_PAYMENT ? null : Number(f.payment_type),
  default_email: f.default_email.trim() || null
});
