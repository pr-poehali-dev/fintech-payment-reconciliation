import { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminPlaceholder from '@/components/admin/AdminPlaceholder';
import AdminCompaniesSection from '@/components/admin/AdminCompaniesSection';

const Admin = () => {
  const [activeSection, setActiveSection] = useState('companies');

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <main className="ml-64 p-8">
        {activeSection === 'companies' && <AdminCompaniesSection />}
        {activeSection === 'roles' && (
          <AdminPlaceholder icon="ShieldCheck" title="Роли" description="Каталог ролей платформы: модули и права доступа" />
        )}
        {activeSection === 'tariffs' && (
          <AdminPlaceholder icon="Tag" title="Тарифы" description="Управление тарифами и их лимитами" />
        )}
        {activeSection === 'subscriptions' && (
          <AdminPlaceholder icon="CreditCard" title="Подписки" description="Статус подписок компаний" />
        )}
        {activeSection === 'integrations' && (
          <AdminPlaceholder icon="Plug" title="Интеграции CRM" description="Каталог провайдеров, доступных всем компаниям" />
        )}
      </main>
    </div>
  );
};

export default Admin;
