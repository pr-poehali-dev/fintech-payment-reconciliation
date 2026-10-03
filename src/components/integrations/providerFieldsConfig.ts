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

export type FieldType = 'text' | 'password' | 'number' | 'checkbox' | 'select' | 'multiselect' | 'keywords';

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

// Шлюз Екомкассы отдаёт статусы 0-4 (создан/оплачен/подтверждён/отменён/просрочен),
// без отдельного события возврата - поэтому REFUNDED здесь не показываем.
export const ECOMKASSA_GATEWAY_NOTIFY_OPTIONS = [
  { key: 'notify_on_authorized', label: 'Оплачен, ожидает подтверждения' },
  { key: 'notify_on_confirmed', label: 'Оплачен, подтверждён' },
  { key: 'notify_on_rejected', label: 'Не оплачен (истекло время)' },
  { key: 'notify_on_canceled', label: 'Отменён' }
];

const BANK_ACCOUNT_FIELDS: FieldConfig[] = [
  { key: 'account_number', label: 'Номер расчётного счёта', type: 'text', placeholder: '40702810000000000000' },
  { key: 'inn', label: 'ИНН организации', type: 'text', placeholder: '1234567890' },
  { key: 'api_token', label: 'Токен API банка', type: 'password', hint: 'Получите в личном кабинете банка в разделе API/интеграции' }
];

// auth_method/api_token/account_number для tochka_account не входят в общий
// список полей - выбор способа авторизации (JWT/OAuth 2.0), сам токен и счёт
// вводятся в TochkaAuthMethodPicker: по JWT-токену запрашивается список счетов
// компании (Get Accounts List), номер счёта выбирается из него, а не вводится
// руками. ИНН отдельно не спрашиваем - он уже есть в карточке компании и в
// синхронизации выписки нигде не используется (Точка идентифицирует счёт по
// accountId из самого токена, а не по ИНН из формы). purpose_keywords и
// sync_interval_hours - те же поля, что и у tbank_account: backend
// (bank-statement-sync/fetch_tochka_account_statement) уже фильтрует операции
// по ключевым словам назначения платежа одинаково для обоих банков.
const TOCHKA_ACCOUNT_FIELDS: FieldConfig[] = [
  {
    key: 'purpose_keywords',
    label: 'Учитывать назначения платежа по ключевым словам',
    type: 'keywords',
    default: '',
    required: false,
    placeholder: 'эквайринг, сбп, оплата заказа',
    hint: 'Через запятую. Операция загрузится, если назначение платежа содержит хотя бы одно из слов. Оставьте пустым, чтобы загружать все операции'
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
];

export const ALFABANK_NOTIFY_OPTIONS = [
  { key: 'notify_on_authorized', label: 'Средства удержаны (approved)' },
  { key: 'notify_on_confirmed', label: 'Оплачен (deposited) — картой и по СБП' },
  { key: 'notify_on_rejected', label: 'Отклонён (declined)' },
  { key: 'notify_on_refunded', label: 'Возврат (refunded)' },
  { key: 'notify_on_canceled', label: 'Отменён (reversed)' }
];

const ALFABANK_ENV_OPTIONS: FieldOption[] = [
  { value: 'prod', label: 'Боевой — payment.alfabank.ru (логин с префиксом r-)' },
  { value: 'prod_pay', label: 'Боевой — pay.alfabank.ru (логин без префикса)' },
  { value: 'test', label: 'Тестовый — alfa.rbsuat.com' }
];

export const PROVIDER_FIELDS: Record<string, FieldConfig[]> = {
  alfabank: [
    { key: 'environment', label: 'Сервер банка', type: 'select', options: ALFABANK_ENV_OPTIONS, default: 'prod', required: false, hint: 'Адрес зависит от логина: уточните у поддержки Альфа-Банка, если не уверены' },
    { key: 'user_name', label: 'Логин API-пользователя', type: 'text', placeholder: 'r-shop-api', hint: 'Учётная запись магазина с окончанием -api из письма Альфа-Банка' },
    { key: 'password', label: 'Пароль API-пользователя', type: 'password', placeholder: '•••••••••' },
    { key: 'callback_secret', label: 'Ключ контрольной суммы уведомлений', type: 'password', required: false, hint: 'Необязательно. Симметричный ключ из поддержки банка — тогда проверяем подпись каждого уведомления. Без ключа подлинность проверяем запросом статуса заказа в банке' }
  ],
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
      key: 'purpose_keywords',
      label: 'Учитывать назначения платежа по ключевым словам',
      type: 'keywords',
      default: '',
      required: false,
      placeholder: 'эквайринг, сбп, оплата заказа',
      hint: 'Через запятую. Операция загрузится, если назначение платежа содержит хотя бы одно из слов. Оставьте пустым, чтобы загружать все операции'
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
  tochka_account: TOCHKA_ACCOUNT_FIELDS,
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
  ],
  // Платёжный шлюз (payments.ecomkassa.ru) не требует токенов - у нас нет
  // прямого доступа к банку, шлюз лишь присылает статус платежа по callback_url.
  // Чек по UUID платежа он находит сам в активной кассе "Екомкасса" той же
  // компании - отдельно указывать магазин здесь не нужно.
  ecomkassa_gateway: []
};

// Провайдеры, для которых наш сервис принимает входящие вебхуки.
// Только для них имеет смысл показывать URL для вебхука и переадресацию.
const PROVIDERS_WITH_INCOMING_WEBHOOK = ['tbank', 'alfabank', 'ecomkassa_gateway'];

export const buildDefaultConfig = (slug: string): ConfigState => {
  const fields = PROVIDER_FIELDS[slug] || [];
  const config: ConfigState = {};
  fields.forEach((field) => {
    config[field.key] = field.default ?? (field.type === 'checkbox' ? false : '');
  });
  return config;
};

// Платёжки, по которым чек делаем сами из корзины: после подключения предлагаем сценарий чеков.
// Шлюз Екомкассы сюда не входит - чек по нему пробивает сама Екомкасса.
const PROVIDERS_WITH_RECEIPT_SCENARIO = ['tbank', 'alfabank'];
export const suggestsReceiptScenario = (slug?: string) => !!slug && PROVIDERS_WITH_RECEIPT_SCENARIO.includes(slug);

export const acceptsIncomingWebhook = (slug?: string) => !!slug && PROVIDERS_WITH_INCOMING_WEBHOOK.includes(slug);