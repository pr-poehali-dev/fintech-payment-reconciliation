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
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import SubscriptionDialog from '@/components/profile/SubscriptionDialog';
import { DateFilter } from '@/components/filters/DateRangeFilter';
import { TYPE_FILTERS, TypeFilter, TypeFilterKey } from '@/lib/transactionTypeFilter';

const Index = () => {
  const { currentCompany, user } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [transactionsDateFilter, setTransactionsDateFilter] = useState<DateFilter | null>(null);
  const [transactionsTypeFilter, setTransactionsTypeFilter] = useState<TypeFilter | null>(null);

  // Переход из «Сверки» (плитки, столбцы графика) в «Транзакции» сразу с
  // фильтром на нужный период.
  const openTransactionsForPeriod = (from: Date, to: Date, typeKey?: TypeFilterKey) => {
    setTransactionsDateFilter({ from, to });
    setTransactionsTypeFilter(typeKey ? TYPE_FILTERS[typeKey] : null);
    setTransactionsUnmatchedOnly(false);
    setTransactionsNavKey((k) => k + 1);
    setActiveModule('transactions');
  };

  const [transactionsUnmatchedOnly, setTransactionsUnmatchedOnly] = useState(false);
  // Меняется при каждом переходе с фильтрами - «Транзакции» пересоздаются и
  // применяют их, даже если раздел уже открыт.
  const [transactionsNavKey, setTransactionsNavKey] = useState(0);

  const openFromNotification = (n: AppNotification) => {
    const day = typeof n.payload?.date === 'string' ? n.payload.date : null;
    if (n.link_module === 'transactions' && day) {
      const [y, m, d] = day.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      setTransactionsDateFilter({ from: date, to: date });
      setTransactionsTypeFilter(null);
      setTransactionsUnmatchedOnly(n.kind === 'missing_receipts');
      setTransactionsNavKey((k) => k + 1);
      setActiveModule('transactions');
      return;
    }
    if (n.link_module) handleModuleChange(n.link_module);
  };

  const handleModuleChange = (id: string) => {
    setTransactionsUnmatchedOnly(false);
    setTransactionsDateFilter(null);
    setTransactionsTypeFilter(null);
    setActiveModule(id);
  };

  const companyId = currentCompany?.id;
  const { stats, reload: reloadDashboardStats } = useDashboardStats(companyId);
  useAutomationHeartbeat(companyId);
  const notifications = useNotifications(companyId, user?.user_id);

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
        <NotificationCenter
          items={notifications.items}
          unread={notifications.unread}
          isLoading={notifications.isLoading}
          onClose={() => setShowNotifications(false)}
          onMarkRead={notifications.markRead}
          onHide={notifications.hide}
          onReload={notifications.reload}
          onOpen={openFromNotification}
        />
      )}

      <AppHeader
        onOpenSubscription={() => setSubscriptionOpen(true)}
        unreadCount={notifications.unread}
        onShowNotifications={() => {
          setShowNotifications(true);
          notifications.reload();
        }}
      />

      <SubscriptionDialog open={subscriptionOpen} onOpenChange={setSubscriptionOpen} />

      <AppSidebar activeModule={activeModule} onModuleChange={handleModuleChange} />

      <main className="ml-64 mt-16 p-8">
        {activeModule === 'dashboard' && <DashboardOverview stats={stats} mounted={mounted} />}
        {activeModule === 'reconciliation' && <ReconciliationPage onOpenTransactions={openTransactionsForPeriod} />}
        {activeModule === 'events' && <EventsPage />}
        {activeModule === 'transactions' && <TransactionsPage key={transactionsNavKey} initialDateFilter={transactionsDateFilter} initialTypeFilter={transactionsTypeFilter} initialUnmatchedOnly={transactionsUnmatchedOnly} />}
        {activeModule === 'automation' && <AutomationPage />}
        {activeModule === 'integrations' && <IntegrationsPage />}
        {activeModule === 'access' && <AccessManagement />}
        {activeModule === 'settings' && <SettingsPlaceholder />}
      </main>
    </div>
  );
};

export default Index;