import { useState, useEffect } from 'react';
import NotificationCenter from '@/components/NotificationCenter';
import AppHeader from '@/components/layout/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar';
import DashboardOverview from './dashboard/DashboardOverview';
import { useDashboardStats } from './dashboard/useDashboardStats';
import AccessManagement from './AccessManagement';
import IntegrationsPage from './IntegrationsPage';
import AutomationPage from './AutomationPage';
import EventsPage from './EventsPage';
import TransactionsPage from './TransactionsPage';
import ReconciliationPage from './ReconciliationPage';
import SettingsPlaceholder from './SettingsPlaceholder';
import { useAuth } from '@/contexts/AuthContext';
import { useAutomationHeartbeat } from '@/hooks/useAutomationHeartbeat';
import SubscriptionDialog from '@/components/profile/SubscriptionDialog';
import { DateFilter } from '@/components/filters/DateRangeFilter';
import { TYPE_FILTERS, TypeFilter, TypeFilterKey } from '@/lib/transactionTypeFilter';

const Index = () => {
  const { currentCompany } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount] = useState(3);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [transactionsDateFilter, setTransactionsDateFilter] = useState<DateFilter | null>(null);
  const [transactionsTypeFilter, setTransactionsTypeFilter] = useState<TypeFilter | null>(null);

  // Переход из «Сверки» (плитки, столбцы графика) в «Транзакции» сразу с
  // фильтром на нужный период.
  const openTransactionsForPeriod = (from: Date, to: Date, typeKey?: TypeFilterKey) => {
    setTransactionsDateFilter({ from, to });
    setTransactionsTypeFilter(typeKey ? TYPE_FILTERS[typeKey] : null);
    setActiveModule('transactions');
  };

  const handleModuleChange = (id: string) => {
    setTransactionsDateFilter(null);
    setTransactionsTypeFilter(null);
    setActiveModule(id);
  };

  const companyId = currentCompany?.id;
  const { stats, reload: reloadDashboardStats } = useDashboardStats(companyId);
  useAutomationHeartbeat(companyId);

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


  return (
    <div className="min-h-screen bg-background">
      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}

      <AppHeader
        onOpenSubscription={() => setSubscriptionOpen(true)}
        unreadCount={unreadCount}
        onShowNotifications={() => setShowNotifications(true)}
      />

      <SubscriptionDialog open={subscriptionOpen} onOpenChange={setSubscriptionOpen} />

      <AppSidebar activeModule={activeModule} onModuleChange={handleModuleChange} />

      <main className="ml-64 mt-16 p-8">
        {activeModule === 'dashboard' && <DashboardOverview stats={stats} mounted={mounted} />}
        {activeModule === 'reconciliation' && <ReconciliationPage onOpenTransactions={openTransactionsForPeriod} />}
        {activeModule === 'events' && <EventsPage />}
        {activeModule === 'transactions' && <TransactionsPage initialDateFilter={transactionsDateFilter} initialTypeFilter={transactionsTypeFilter} />}
        {activeModule === 'automation' && <AutomationPage />}
        {activeModule === 'integrations' && <IntegrationsPage />}
        {activeModule === 'access' && <AccessManagement />}
        {activeModule === 'settings' && <SettingsPlaceholder />}
      </main>
    </div>
  );
};

export default Index;