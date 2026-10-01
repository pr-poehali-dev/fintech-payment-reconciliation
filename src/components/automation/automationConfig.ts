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
  category: string;
}

// sourceCategories: категории интеграций для выбора источника (null - внутренний источник)
export const TRIGGERS: Record<TriggerType, { label: string; icon: string; description: string; sourceCategories: string[] | null; needsMapping: boolean }> = {
  new_payment: { label: 'Новый платёж', icon: 'CreditCard', description: 'Пришёл вебхук об оплате от эквайринга', sourceCategories: ['payments'], needsMapping: false },
  crm_order: { label: 'Заказ в CRM', icon: 'Users', description: 'Сделка или заказ в CRM перешли в нужную стадию', sourceCategories: ['crm'], needsMapping: true },
  discrepancy: { label: 'Расхождение', icon: 'TriangleAlert', description: 'Сверка нашла платёж без чека или чек без денег', sourceCategories: null, needsMapping: false }
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
}

export const TARGET_CATEGORIES = ['cash_registers'];

// Поля будущего чека, которые нужно сопоставить с полями CRM.
export const MAPPING_FIELDS: { key: string; label: string; placeholder: string; required?: boolean }[] = [
  { key: 'order_id', label: 'Номер заказа', placeholder: 'ID', required: true },
  { key: 'amount', label: 'Сумма', placeholder: 'OPPORTUNITY', required: true },
  { key: 'items', label: 'Товары', placeholder: 'PRODUCT_ROWS', required: true },
  { key: 'customer_email', label: 'Email покупателя', placeholder: 'CONTACT_EMAIL' },
  { key: 'customer_phone', label: 'Телефон покупателя', placeholder: 'CONTACT_PHONE' },
  { key: 'stage', label: 'Стадия для запуска', placeholder: 'C1:WON' }
];

export const JOB_STATUS: Record<JobStatus, { label: string; className: string }> = {
  new: { label: 'В очереди', className: 'bg-muted text-muted-foreground border-border' },
  processing: { label: 'В работе', className: 'bg-info/15 text-info border-info/30' },
  ready: { label: 'Данные собраны', className: 'bg-info/15 text-info border-info/30' },
  done: { label: 'Выполнено', className: 'bg-success/15 text-success border-success/30' },
  skipped: { label: 'Пропущен', className: 'bg-muted text-muted-foreground border-border' },
  error: { label: 'Ошибка, повтор', className: 'bg-warning/15 text-warning border-warning/30' },
  failed: { label: 'Не удалось', className: 'bg-destructive/15 text-destructive border-destructive/30' }
};
