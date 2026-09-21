export interface AppModule {
  id: string;
  name: string;
  icon: string;
}

export const APP_MODULES: AppModule[] = [
  { id: 'dashboard', name: 'Дашборд', icon: 'LayoutDashboard' },
  { id: 'payments', name: 'Платежи', icon: 'CreditCard' },
  { id: 'receipts', name: 'Чеки', icon: 'Receipt' },
  { id: 'reconciliation', name: 'Сверка', icon: 'GitCompare' },
  { id: 'integrations', name: 'Интеграции', icon: 'Plug' },
  { id: 'access', name: 'Доступ', icon: 'Users' },
  { id: 'settings', name: 'Настройки', icon: 'Settings' }
];
