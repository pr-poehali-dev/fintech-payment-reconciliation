export interface AdminSection {
  id: string;
  name: string;
  icon: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { id: 'companies', name: 'Компании', icon: 'Building2' },
  { id: 'roles', name: 'Роли', icon: 'ShieldCheck' },
  { id: 'action_templates', name: 'Шаблоны действий', icon: 'Workflow' },
  { id: 'tariffs', name: 'Тарифы', icon: 'Tag' },
  { id: 'subscriptions', name: 'Подписки', icon: 'CreditCard' },
  { id: 'integrations', name: 'Интеграции CRM', icon: 'Plug' }
];
