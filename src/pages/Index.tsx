import { useState, useEffect } from 'react';
import NotificationCenter from '@/components/NotificationCenter';
import AppHeader from '@/components/layout/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar';
import DashboardOverview from './dashboard/DashboardOverview';
import { useDashboardStats } from './dashboard/useDashboardStats';
import AccessManagement from './AccessManagement';
import IntegrationsPage from './IntegrationsPage';
import ReceiptsPage from './ReceiptsPage';
import EventsPage from './EventsPage';
import TransactionsPage from './TransactionsPage';
import ReconciliationPage from './ReconciliationPage';
import SettingsPlaceholder from './SettingsPlaceholder';
import { useAuth } from '@/contexts/AuthContext';
import { APP_MODULES } from '@/config/modules';

const Index = () => {
  const { currentCompany } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount] = useState(3);

  const companyId = currentCompany?.id;
  const { stats, reload: reloadDashboardStats } = useDashboardStats(companyId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Хук грузит статистику один раз при монтировании - без этого при переходе
  // на вкладку "Дашборд" из другого раздела (например, после переноса
  // интеграции в другую компанию) показывались бы данные, загруженные ещё
  // при открытии приложения.
  useEffect(() => {
    if (activeModule === 'dashboard') {
      reloadDashboardStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule]);

  const activeModuleName = APP_MODULES.find(m => m.id === activeModule)?.name || 'Дашборд';

  return (
    <div className="min-h-screen bg-background">
      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}

      <AppHeader
        title={activeModuleName}
        unreadCount={unreadCount}
        onShowNotifications={() => setShowNotifications(true)}
      />

      <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />

      <main className="ml-64 mt-16 p-8">
        {activeModule === 'dashboard' && <DashboardOverview stats={stats} mounted={mounted} />}
        {activeModule === 'receipts' && <ReceiptsPage />}
        {activeModule === 'reconciliation' && <ReconciliationPage />}
        {activeModule === 'events' && <EventsPage />}
        {activeModule === 'transactions' && <TransactionsPage />}
        {activeModule === 'integrations' && <IntegrationsPage />}
        {activeModule === 'access' && <AccessManagement />}
        {activeModule === 'settings' && <SettingsPlaceholder />}
      </main>
    </div>
  );
};

export default Index;