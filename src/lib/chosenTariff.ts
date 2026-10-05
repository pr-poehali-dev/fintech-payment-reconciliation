// Тариф, выбранный на главной: живёт до создания компании (между ними - вход по телефону).
const KEY = 'chosen_tariff';
const TTL_MS = 24 * 60 * 60 * 1000;

export const rememberTariff = (slug: string) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {
    /* хранилище недоступно - стартуем на тарифе по умолчанию */
  }
};

export const chosenTariff = (): string | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { slug, at } = JSON.parse(raw);
    return typeof slug === 'string' && Date.now() - at < TTL_MS ? slug : null;
  } catch {
    return null;
  }
};

export const forgetTariff = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
