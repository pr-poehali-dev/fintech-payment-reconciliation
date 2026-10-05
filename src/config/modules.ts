export interface AppModule {
  id: string;
  name: string;
  icon: string;
  hidden?: boolean;
  // Служебная страница, открыта всем: не настраивается ни в тарифах, ни в ролях.
  alwaysOpen?: boolean;
}

export const APP_MODULES: AppModule[] = [
  { id: 'reconciliation', name: 'Сверка', icon: 'GitCompare' },
  { id: 'events', name: 'События', icon: 'Radio' },
  { id: 'transactions', name: 'Транзакции', icon: 'ArrowLeftRight' },
  { id: 'automation', name: 'Автоматизация', icon: 'Workflow' },
  { id: 'integrations', name: 'Интеграции', icon: 'Plug' },
  { id: 'access', name: 'Доступ', icon: 'Users' },
  { id: 'settings', name: 'Настройки', icon: 'Settings', hidden: true },
  { id: 'subscription', name: 'Подписка', icon: 'CreditCard', hidden: true, alwaysOpen: true }
];

// Разделы, которые включаются в тариф: без служебных страниц («Настройки», «Подписка») - они открыты всегда.
export const TARIFF_MODULES = APP_MODULES.filter((m) => !m.hidden);

// Разделы, которые настраиваются в роли сотрудника.
export const ROLE_MODULES = APP_MODULES.filter((m) => !m.alwaysOpen);

// Разделы, доступные роли сотрудника в компании, в порядке меню. Если права
// роли ещё не загрузились (старый кэш входа), ничего не скрываем.
export const allowedModules = (roleModules?: string[] | null): AppModule[] =>
  roleModules ? APP_MODULES.filter((m) => roleModules.includes(m.id)) : APP_MODULES;

export const canOpenModule = (roleModules: string[] | null | undefined, id: string) =>
  !roleModules || roleModules.includes(id);

// Стартовый раздел: «Сверка», если она есть в роли, иначе первый разрешённый пункт меню.
export const defaultModuleFor = (roleModules?: string[] | null): string | null => {
  if (canOpenModule(roleModules, 'reconciliation')) return 'reconciliation';
  const first = allowedModules(roleModules).find((m) => !m.hidden) ?? allowedModules(roleModules)[0];
  return first ? first.id : null;
};

// Раздел есть в роли сотрудника, но не входит в тариф компании - показываем
// его в меню с замком и предлагаем сменить тариф.
export const isLockedByTariff = (
  company: { role_modules?: string[]; tariff_modules?: string[] | null } | null | undefined,
  id: string
) => {
  const tariff = company?.tariff_modules;
  if (!tariff || id === 'settings' || id === 'subscription') return false;
  const role = company?.role_modules;
  return (!role || role.includes(id)) && !tariff.includes(id);
};

// Разделы для меню: доступные роли (включая закрытые тарифом).
export const menuModules = (company?: { role_modules?: string[] } | null) =>
  allowedModules(company?.role_modules).filter((m) => !m.hidden);

// Разделы, доступные сотруднику: входят и в его роль, и в тариф компании.
// «Настройки» - исключение: там личные уведомления, они нужны всем.
export const effectiveModules = (company?: { role_modules?: string[]; tariff_modules?: string[] | null } | null) => {
  const role = company?.role_modules;
  const tariff = company?.tariff_modules;
  if (!role && !tariff) return undefined;
  return APP_MODULES.filter(
    (m) => (m.alwaysOpen || !role || role.includes(m.id)) && (m.hidden || !tariff || tariff.includes(m.id))
  ).map((m) => m.id);
};