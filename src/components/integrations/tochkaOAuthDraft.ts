import { ConfigState } from './providerFieldsConfig';

// Незаконченная форма подключения Точки на время перехода в банк и обратно.
const KEY = 'tochka_oauth_draft';
const TTL_MS = 30 * 60 * 1000;

export interface TochkaOAuthDraft {
  companyId: number;
  integrationId: number | null;
  integrationName: string;
  config: ConfigState;
  savedAt: number;
}

export const saveTochkaDraft = (draft: Omit<TochkaOAuthDraft, 'savedAt'>) => {
  localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
};

export const takeTochkaDraft = (companyId: number): TochkaOAuthDraft | null => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  localStorage.removeItem(KEY);
  try {
    const draft: TochkaOAuthDraft = JSON.parse(raw);
    if (draft.companyId !== companyId || Date.now() - draft.savedAt > TTL_MS) return null;
    return draft;
  } catch {
    return null;
  }
};
