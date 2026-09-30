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
  scenarios_count: number;
}

export type ActionTemplateForm = Omit<ActionTemplateRow, 'id' | 'scenarios_count' | 'description'> & { description: string };

export const ACTION_TYPE_OPTIONS = [
  { value: 'create_receipt', label: 'Создать чек', icon: 'Receipt' },
  { value: 'create_order', label: 'Создать заказ', icon: 'Truck' }
] as const;

export const OPERATION_OPTIONS = [
  { value: 'sell', label: 'Приход' },
  { value: 'sell_refund', label: 'Возврат прихода' },
  { value: 'sell_correction', label: 'Коррекция прихода' },
  { value: 'buy', label: 'Расход' },
  { value: 'buy_refund', label: 'Возврат расхода' },
  { value: 'buy_correction', label: 'Коррекция расхода' }
];

export const EMPTY_TEMPLATE: ActionTemplateForm = {
  code: '',
  action_type: 'create_order',
  name: '',
  description: '',
  operation: 'sell',
  paid: true,
  is_active: true,
  sort_order: 100
};

export const operationLabel = (value: string) => OPERATION_OPTIONS.find((o) => o.value === value)?.label || value;
