import { useState, useEffect } from 'react';
import NotificationCenter from '@/components/NotificationCenter';
import AppHeader from '@/components/layout/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar';
import DashboardOverview from './dashboard/DashboardOverview';
import { useDashboardStats } from './dashboard/useDashboardStats';
import AccessManagement from './AccessManagement';
import IntegrationsPage from './IntegrationsPage';
import PaymentsPage from './PaymentsPage';
import ReceiptsPage from './ReceiptsPage';
import ReconciliationPlaceholder from './ReconciliationPlaceholder';
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
  const { stats } = useDashboardStats(companyId);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        {activeModule === 'payments' && <PaymentsPage />}
        {activeModule === 'receipts' && <ReceiptsPage />}
        {activeModule === 'reconciliation' && <ReconciliationPlaceholder />}
        {activeModule === 'integrations' && <IntegrationsPage />}
        {activeModule === 'access' && <AccessManagement />}
        {activeModule === 'settings' && <SettingsPlaceholder />}
      </main>
    </div>
  );
};

export default Index;
