export interface Provider {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  description: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  providers: Provider[];
}

export type ConfigValue = string | number | boolean | string[];
export type ConfigState = Record<string, ConfigValue>;

export interface UserIntegration {
  id: number;
  integration_name: string;
  provider_id: number;
  config: ConfigState;
  webhook_settings: Record<string, boolean>;
  forward_url?: string;
}

export type FieldType = 'text' | 'password' | 'number' | 'checkbox' | 'select' | 'multiselect';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  default?: ConfigValue;
  required?: boolean;
  options?: FieldOption[];
}

export const PURPOSE_CATEGORY_OPTIONS: FieldOption[] = [
  { value: 'acquiring_online', label: 'Интернет-эквайринг' },
  { value: 'acquiring_offline', label: 'Торговый эквайринг' },
  { value: 'individual_direct', label: 'Оплата от физлица напрямую на счёт' }
];

export const SYNC_INTERVAL_OPTIONS: FieldOption[] = [
  { value: '24', label: '1 раз в сутки (каждые 24 часа)' },
  { value: '12', label: '2 раза в сутки (каждые 12 часов)' }
];

export const ECOMKASSA_PROTOCOL_OPTIONS: FieldOption[] = [
  { value: 'v4', label: 'v4 (текущая)' },
  { value: 'v5', label: 'v5' }
];

export const DEFAULT_WEBHOOK_SETTINGS: Record<string, boolean> = {
  notify_on_authorized: true,
  notify_on_confirmed: true,
  notify_on_rejected: true,
  notify_on_refunded: true,
  notify_on_canceled: true
};

export const TBANK_NOTIFY_OPTIONS = [
  { key: 'notify_on_authorized', label: 'Авторизован (AUTHORIZED)' },
  { key: 'notify_on_confirmed', label: 'Подтверждён (CONFIRMED)' },
  { key: 'notify_on_rejected', label: 'Отклонён (REJECTED)' },
  { key: 'notify_on_refunded', label: 'Возврат (REFUNDED)' },
  { key: 'notify_on_canceled', label: 'Отменён (CANCELED)' }
];

const BANK_ACCOUNT_FIELDS: FieldConfig[] = [
  { key: 'account_number', label: 'Номер расчётного счёта', type: 'text', placeholder: '40702810000000000000' },
  { key: 'inn', label: 'ИНН организации', type: 'text', placeholder: '1234567890' },
  { key: 'api_token', label: 'Токен API банка', type: 'password', hint: 'Получите в личном кабинете банка в разделе API/интеграции' }
];

export const PROVIDER_FIELDS: Record<string, FieldConfig[]> = {
  tbank: [
    { key: 'terminal_id', label: 'Terminal ID', type: 'text', placeholder: '1234567890', hint: 'Найдите в ЛК Т-Банк → Настройки → Терминалы' },
    { key: 'terminal_password', label: 'Terminal Password', type: 'password', placeholder: '•••••••••' }
  ],
  ofdru: [
    { key: 'api_url', label: 'API сервер', type: 'text', placeholder: 'https://ofd.ru', default: 'https://ofd.ru', hint: 'Используйте https://demo.ofd.ru для тестирования' },
    { key: 'inn', label: 'ИНН организации', type: 'text', placeholder: '1234567890', hint: 'ИНН юридического лица (10 или 12 цифр)' },
    { key: 'kkt', label: 'Регистрационный номер ККТ', type: 'text', placeholder: '0000111122223333', hint: 'Номер контрольно-кассовой техники' },
    { key: 'auth_token', label: 'Токен API', type: 'password', hint: 'Получите в ЛК OFD.RU → Настройки → Управление передачей данных → Ключи доступа API OFD' }
  ],
  bitrix24: [
    { key: 'webhook_url', label: 'Входящий вебхук Битрикс24', type: 'text', placeholder: 'https://yourcompany.bitrix24.ru/rest/1/xxxxxxxxxx/', hint: 'Битрикс24 → Разработчикам → Другое → Входящий вебхук. Права: crm' },
    { key: 'sync_schedule', label: 'Обмен по расписанию', type: 'checkbox', default: true, required: false, hint: 'Клиенты и статусы синхронизируются сами, без кнопки' },
    { key: 'sync_interval_minutes', label: 'Как часто, минут', type: 'number', placeholder: '60', default: 60, required: false, hint: 'Реже — меньше нагрузки на Битрикс' }
  ],
  amocrm: [
    { key: 'subdomain', label: 'Поддомен AmoCRM', type: 'text', placeholder: 'yourcompany', hint: 'Из адреса вида yourcompany.amocrm.ru' },
    { key: 'api_key', label: 'Долгосрочный токен доступа', type: 'password', hint: 'AmoCRM → Настройки → Интеграции → Создать интеграцию' }
  ],
  // account_number для tbank_account не входит в общий список полей -
  // выбирается отдельным компонентом (TbankAccountPicker): автоматически из
  // списка счетов, если владелец подтвердил доступ через Т-Бизнес, либо вручную.
  tbank_account: [
    {
      key: 'purpose_categories',
      label: 'Учитывать назначения платежа',
      type: 'multiselect',
      options: PURPOSE_CATEGORY_OPTIONS,
      default: PURPOSE_CATEGORY_OPTIONS.map(o => o.value),
      required: false,
      hint: 'Остальные операции (налоги, зарплата, внутренние переводы) загружаться не будут'
    },
    {
      key: 'sync_interval_hours',
      label: 'Периодичность синхронизации',
      type: 'select',
      options: SYNC_INTERVAL_OPTIONS,
      default: '24',
      required: false,
      hint: 'Пока реально работает только кнопка «Синхронизировать сейчас» — настройка сохранится на будущее'
    }
  ],
  tochka_account: BANK_ACCOUNT_FIELDS,
  modulbank_account: BANK_ACCOUNT_FIELDS,
  // login/password/store_id для ecomkassa не входят в общий список полей -
  // логин и пароль вводятся в EcomkassaStorePicker, который по ним получает
  // токен и список магазинов, а сам магазин выбирается там же из списка.
  ecomkassa: [
    {
      key: 'protocol_version',
      label: 'Версия протокола',
      type: 'select',
      options: ECOMKASSA_PROTOCOL_OPTIONS,
      default: 'v4',
      required: false,
      hint: 'Уточните у Екомкассы, если не уверены — по умолчанию v4'
    }
  ]
};

// Провайдеры, для которых наш сервис принимает входящие вебхуки.
// Только для них имеет смысл показывать URL для вебхука и переадресацию.
const PROVIDERS_WITH_INCOMING_WEBHOOK = ['tbank'];

export const buildDefaultConfig = (slug: string): ConfigState => {
  const fields = PROVIDER_FIELDS[slug] || [];
  const config: ConfigState = {};
  fields.forEach((field) => {
    config[field.key] = field.default ?? (field.type === 'checkbox' ? false : '');
  });
  return config;
};

export const acceptsIncomingWebhook = (slug?: string) => !!slug && PROVIDERS_WITH_INCOMING_WEBHOOK.includes(slug);