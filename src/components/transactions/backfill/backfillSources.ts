import functionUrls from '../../../../backend/func2url.json';

export interface NamedIntegration {
  id: number;
  name: string;
}

export interface ActiveSources {
  ecomkassa: NamedIntegration[];
  ofd: NamedIntegration[];
  bank: NamedIntegration[];
}

export type DocType = 'payments' | 'receipts' | 'money' | 'orders';

// Что пользователь выбирает в окне -> откуда это грузится:
// - Платежи: счета Екомкассы (INVC - счёт с оплатой через шлюз = факт платежа);
// - Чеки: чеки Екомкассы (VCHR) + чеки ОФД;
// - Деньги: выписка по расчётным счетам банков;
// - Заказы: курьерские заказы Екомкассы (CORD).
export const DOC_TYPES: { id: DocType; label: string; icon: string }[] = [
  { id: 'payments', label: 'Платежи', icon: 'CreditCard' },
  { id: 'receipts', label: 'Чеки', icon: 'Receipt' },
  { id: 'money', label: 'Деньги', icon: 'Landmark' },
  { id: 'orders', label: 'Заказы', icon: 'Truck' },
];

// Дозагрузка всегда только по успешно завершённым документам.
export const BACKFILL_STATUSES = ['COMPLETED'];

export const isDocTypeAvailable = (type: DocType, s: ActiveSources) => {
  if (type === 'receipts') return s.ecomkassa.length > 0 || s.ofd.length > 0;
  if (type === 'money') return s.bank.length > 0;
  return s.ecomkassa.length > 0;
};

export const sourcesHint = (type: DocType, s: ActiveSources) => {
  const names =
    type === 'receipts'
      ? [...s.ecomkassa, ...s.ofd]
      : type === 'money'
      ? s.bank
      : s.ecomkassa;
  return names.length > 0 ? names.map((i) => i.name).join(', ') : 'нет активной интеграции';
};

export const ecomkassaOrderTypes = (types: DocType[]) => {
  const result: string[] = [];
  if (types.includes('receipts')) result.push('VCHR');
  if (types.includes('payments')) result.push('INVC');
  if (types.includes('orders')) result.push('CORD');
  return result;
};

interface IntegrationRow {
  id: number;
  integration_name: string;
  provider_slug: string;
  status: string;
}

// Свежая проверка прямо перед запуском: интеграция могла быть отключена
// (или только что подключена) с момента открытия страницы.
export const fetchActiveSources = async (companyId: number): Promise<ActiveSources> => {
  const res = await fetch(`${functionUrls['integrations-list']}?company_id=${companyId}`);
  const data = await res.json();
  const integrations: IntegrationRow[] = data.user_integrations || [];
  const pick = (slugs: string[]) =>
    integrations
      .filter((i) => slugs.includes(i.provider_slug) && i.status === 'active')
      .map((i) => ({ id: i.id, name: i.integration_name }));
  return {
    ecomkassa: pick(['ecomkassa']),
    ofd: pick(['ofdru']),
    bank: pick(['tbank_account', 'tochka_account']),
  };
};
