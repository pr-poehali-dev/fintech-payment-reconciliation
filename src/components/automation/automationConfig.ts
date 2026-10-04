export type TriggerType = 'new_payment' | 'crm_order' | 'discrepancy';
export type ActionType = 'create_receipt' | 'create_order';
export type ActionTemplate = string;
export type ScenarioStatus = 'active' | 'stopped';
export type JobStatus = 'new' | 'processing' | 'ready' | 'done' | 'skipped' | 'error' | 'failed';

export interface Scenario {
  id: number;
  name: string;
  trigger_type: TriggerType;
  source_integration_id: number | null;
  source_integration_name: string | null;
  action_type: ActionType;
  action_template: ActionTemplate;
  action_template_name?: string | null;
  target_integration_id: number | null;
  target_integration_name: string | null;
  field_mapping: Record<string, string>;
  correction_settings?: CorrectionSettings;
  status: ScenarioStatus;
  jobs_total: number;
  jobs_errors: number;
  last_job_at: string | null;
}

export interface AutomationJob {
  id: number;
  scenario_id: number;
  scenario_name: string;
  source_type: string;
  source_id: string;
  status: JobStatus;
  step: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: string;
}

export interface IntegrationOption {
  id: number;
  name: string;
  providerName: string;
  providerSlug?: string;
  category: string;
}

// sourceCategories: категории интеграций для выбора источника (null - внутренний источник)
export const TRIGGERS: Record<TriggerType, { label: string; icon: string; description: string; sourceCategories: string[] | null; needsMapping: boolean; actions?: ActionType[] }> = {
  new_payment: { label: 'Новый платёж', icon: 'CreditCard', description: 'Пришёл вебхук об оплате от эквайринга', sourceCategories: ['payments'], needsMapping: false },
  crm_order: { label: 'Заказ в CRM', icon: 'Users', description: 'Сделка или заказ в CRM перешли в нужную стадию', sourceCategories: ['crm'], needsMapping: true },
  discrepancy: { label: 'Расхождение', icon: 'TriangleAlert', description: 'Оплаченный платёж так и не получил чек — пробиваем чек (обычно коррекции) по его корзине', sourceCategories: null, needsMapping: false, actions: ['create_receipt'] }
};

export const ACTIONS: Record<ActionType, { label: string; icon: string }> = {
  create_receipt: { label: 'Создать чек', icon: 'Receipt' },
  create_order: { label: 'Создать заказ', icon: 'Truck' }
};

// Шаблоны действий приходят из каталога платформы (админка → «Шаблоны действий»).
export interface ActionTemplateOption {
  code: string;
  name: string;
  action_type: ActionType;
  description: string | null;
  receipt_type?: string;
  protocol_version?: string;
  correction_base_number?: string | null;
  default_email?: string | null;
}

// Поля чека коррекции, которые задаются в сценарии (АТОЛ Онлайн):
// v4 (ФФД 1.05) - номер (1179) и описание (1177) основания обязательны;
// v5 (ФФД 1.2) - номер основания необязателен, описания нет. Место расчётов (1187) - в обеих.
export interface CorrectionSettings {
  correction_base_number?: string;
  correction_base_name?: string;
  payment_address?: string;
  default_email?: string;
}

export const TARGET_CATEGORIES = ['cash_registers'];

// «Расхождение»: через сколько минут после оплаты считать, что чека нет.
export const DISCREPANCY_DELAY_OPTIONS = [
  { value: 5, label: '5 минут' },
  { value: 15, label: '15 минут' },
  { value: 30, label: '30 минут' },
  { value: 60, label: '1 час' },
  { value: 180, label: '3 часа' },
  { value: 720, label: '12 часов' },
  { value: 1440, label: '1 сутки' }
];
export const DEFAULT_DISCREPANCY_DELAY = 60;

// Сопоставление полей CRM для сценария «Заказ в CRM» (хранится в field_mapping сценария).
// Ссылка на поле - «объект.КОД»: deal.OPPORTUNITY, contact.EMAIL, company.UF_CRM_123.
export type CrmEntity = 'deal' | 'lead';
export type ItemsMode = 'products' | 'fixed' | 'single';

export interface FixedItem {
  name: string;
  price: string;
  quantity: string;
}

export const MAPPING_FIELDS: { key: string; label: string; required?: boolean; hint?: string }[] = [
  { key: 'order_id', label: 'Номер заказа', required: true },
  { key: 'amount', label: 'Сумма', hint: 'Для сверки с суммой товаров' },
  { key: 'customer_email', label: 'Email покупателя' },
  { key: 'customer_phone', label: 'Телефон покупателя' },
  { key: 'customer_name', label: 'Покупатель (имя / название)' },
  { key: 'customer_inn', label: 'ИНН покупателя' }
];

export const DEFAULT_CRM_MAPPING: Record<string, unknown> = {
  entity: 'deal',
  pipeline: '',
  stage: '',
  order_id: 'deal.ID',
  amount: 'deal.OPPORTUNITY',
  customer_email: 'contact.EMAIL',
  customer_phone: 'contact.PHONE',
  customer_name: '',
  customer_inn: '',
  items_mode: 'products',
  fixed_items: [],
  single_item_name: 'Оплата по сделке №{ID}',
  vat: 'auto'
};

export const ENTITY_LABELS: Record<string, string> = { deal: 'Сделка', lead: 'Лид', contact: 'Контакт', company: 'Компания' };

export const ITEMS_MODES: { value: ItemsMode; label: string; description: string }[] = [
  { value: 'products', label: 'Товары из CRM', description: 'Берём товарные строки сделки как есть' },
  { value: 'fixed', label: 'Фиксированный', description: 'Всегда один и тот же состав чека' },
  { value: 'single', label: 'Одной позицией', description: 'Одна строка на сумму из поля «Сумма»' }
];

export const VAT_OPTIONS = [
  { value: 'auto', label: 'Как в CRM' },
  { value: 'none', label: 'Без НДС' },
  { value: 'vat0', label: 'НДС 0%' },
  { value: 'vat5', label: 'НДС 5%' },
  { value: 'vat7', label: 'НДС 7%' },
  { value: 'vat10', label: 'НДС 10%' },
  { value: 'vat20', label: 'НДС 20%' },
  { value: 'vat22', label: 'НДС 22%' }
];

export interface CrmField {
  ref: string;
  code: string;
  title: string;
  type: string;
  multiple: boolean;
  custom: boolean;
}

export interface CrmStage {
  value: string;
  label: string;
  group?: string;
  group_id?: string;
}

export interface CrmMeta {
  fields: Record<string, CrmField[]>;
  stages: Record<CrmEntity, CrmStage[]>;
}

export const JOB_STATUS: Record<JobStatus, { label: string; className: string }> = {
  new: { label: 'В очереди', className: 'bg-muted text-muted-foreground border-border' },
  processing: { label: 'В работе', className: 'bg-info/15 text-info border-info/30' },
  ready: { label: 'Данные собраны', className: 'bg-info/15 text-info border-info/30' },
  done: { label: 'Выполнено', className: 'bg-success/15 text-success border-success/30' },
  skipped: { label: 'Пропущен', className: 'bg-muted text-muted-foreground border-border' },
  error: { label: 'Ошибка, повтор', className: 'bg-warning/15 text-warning border-warning/30' },
  failed: { label: 'Не удалось', className: 'bg-destructive/15 text-destructive border-destructive/30' }
};
