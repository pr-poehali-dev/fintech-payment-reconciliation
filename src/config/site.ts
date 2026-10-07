// Адрес кабинета для ссылок, которые уходят наружу (приглашения и т.п.).
// Порядок выбора:
// 1. VITE_SITE_URL — если явно задан при сборке, используется всегда.
// 2. Текущий домен, на котором открыт кабинет, — если это «настоящий» домен.
// 3. FALLBACK_SITE_URL — если кабинет открыт в предпросмотре / локально,
//    чтобы в приглашение не попал временный технический адрес.

const FALLBACK_SITE_URL = 'https://s-verka.ru';

// Хосты, которые нельзя отдавать наружу (предпросмотр, разработка).
const TECHNICAL_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /(^|\.)poehali\.dev$/i,
  /(^|\.)preview\./i,
];

const isTechnicalHost = (host: string) =>
  TECHNICAL_HOST_PATTERNS.some((re) => re.test(host));

export const getSiteUrl = (): string => {
  const envUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (!isTechnicalHost(window.location.hostname)) {
      return window.location.origin;
    }
  }

  return FALLBACK_SITE_URL;
};

export const SITE_URL = getSiteUrl();

export default SITE_URL;
