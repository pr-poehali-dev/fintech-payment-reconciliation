// Электронная коммерция Яндекс Метрики (контейнер dataLayer): тарифы как товары.
export interface EcomTariff {
  slug: string;
  name: string;
  price: number;
}

const push = (event: string, products: Record<string, unknown>[], extra: Record<string, unknown> = {}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: { currencyCode: 'RUB', [event]: { ...extra, products } } });
};

const product = (t: EcomTariff, yearly: boolean, position?: number) => ({
  id: t.slug,
  name: t.name,
  price: t.price,
  category: 'Тарифы',
  variant: yearly ? 'Год' : 'Месяц',
  ...(position ? { position } : {})
});

export const ecomImpressions = (tariffs: EcomTariff[], yearly: boolean) =>
  push('impressions', tariffs.map((t, i) => ({ ...product(t, yearly, i + 1), list: 'Тарифы на сайте' })));

export const ecomDetail = (t: EcomTariff, yearly: boolean) => push('detail', [product(t, yearly)]);

export const ecomAdd = (t: EcomTariff, yearly: boolean) => push('add', [{ ...product(t, yearly), quantity: 1 }]);

export const ecomPurchase = (orderId: string, t: EcomTariff, yearly: boolean, revenue: number) =>
  push('purchase', [{ ...product(t, yearly), quantity: 1, price: revenue }], { actionField: { id: orderId, revenue } });
