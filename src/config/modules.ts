export interface AppModule {
  id: string;
  name: string;
  icon: string;
}

export const APP_MODULES: AppModule[] = [
  { id: 'dashboard', name: 'Дашборд', icon: 'LayoutDashboard' },
  { id: 'receipts', name: 'Чеки', icon: 'Receipt' },
  { id: 'reconciliation', name: 'Сверка', icon: 'GitCompare' },
  { id: 'events', name: 'События', icon: 'Radio' },
  { id: 'integrations', name: 'Интеграции', icon: 'Plug' },
  { id: 'access', name: 'Доступ', icon: 'Users' },
  { id: 'settings', name: 'Настройки', icon: 'Settings' }
];