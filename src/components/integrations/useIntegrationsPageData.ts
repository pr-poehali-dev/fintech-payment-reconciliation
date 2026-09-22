import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../../backend/func2url.json';
import { Category, Provider, UserIntegration } from './integrationsPageTypes';

export const useIntegrationsPageData = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [editingIntegration, setEditingIntegration] = useState<UserIntegration | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState<UserIntegration | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState<number | null>(null);
  const [loadingStatement, setLoadingStatement] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const fetchIntegrations = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${functionUrls['integrations-list']}?company_id=${companyId}`);
      const data = await response.json();

      if (response.ok) {
        setCategories(data.categories || []);
        setUserIntegrations(data.user_integrations || []);

        const providers: Provider[] = [];
        (data.categories || []).forEach((cat: Category) => {
          providers.push(...cat.providers);
        });
        setAllProviders(providers);
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить интеграции',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        description: 'Проверьте интернет-соединение',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddNew = () => {
    setEditingIntegration(null);
    setShowAddDialog(true);
  };

  const handleEdit = (integration: UserIntegration) => {
    setEditingIntegration(integration);
    setShowAddDialog(true);
  };

  const handleDeleteClick = (integration: UserIntegration) => {
    setDeletingIntegration(integration);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIntegration) return;

    try {
      const response = await fetch(functionUrls['integrations-delete'], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: deletingIntegration.id, company_id: companyId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: 'Интеграция удалена' });
        fetchIntegrations();
        setShowDeleteDialog(false);
        setDeletingIntegration(null);
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось удалить',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        variant: 'destructive'
      });
    }
  };

  const copyWebhookUrl = (token: string) => {
    const url = `${functionUrls['webhook-receive']}?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Скопировано',
      description: 'URL вебхука скопирован в буфер обмена'
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const handleFetchReceipts = async (integrationId: number, days: number) => {
    setLoadingReceipts(integrationId);

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    try {
      const response = await fetch(functionUrls['ofd-fetch-receipts'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_id: integrationId,
          date_from: dateFrom.toISOString(),
          date_to: dateTo.toISOString()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const periodLabel = days === 1 ? 'за вчера' : `за последние ${days} дней`;
        toast({
          title: 'Чеки загружены',
          description: `Загружено ${data.inserted} из ${data.total_receipts} чеков ${periodLabel}`
        });
      } else {
        console.error('OFD Error Details:', data);

        const debugInfo = data.debug ?
          `\n\nURL: ${data.debug.full_url}\nAPI: ${data.debug.api_url}\nПериод: ${data.debug.date_from} - ${data.debug.date_to}` : '';

        toast({
          title: 'Ошибка загрузки',
          description: (data.error || 'Не удалось загрузить чеки') + debugInfo,
          variant: 'destructive',
          duration: 10000
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        variant: 'destructive'
      });
    } finally {
      setLoadingReceipts(null);
    }
  };

  const handleSyncStatement = async (integrationId: number) => {
    setLoadingStatement(integrationId);

    try {
      const response = await fetch(functionUrls['bank-statement-sync'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integrationId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Выписка синхронизирована',
          description: `Загружено ${data.inserted} новых операций из ${data.total_transactions}`
        });
      } else {
        toast({
          title: 'Ошибка синхронизации',
          description: data.error || 'Не удалось получить выписку',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        variant: 'destructive'
      });
    } finally {
      setLoadingStatement(null);
    }
  };

  const getCategoryIntegrations = (categorySlug: string) => {
    return userIntegrations.filter(ui => ui.category_slug === categorySlug);
  };

  return {
    categories,
    userIntegrations,
    allProviders,
    editingIntegration,
    deletingIntegration,
    showAddDialog,
    setShowAddDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    isLoading,
    loadingReceipts,
    loadingStatement,
    expandedIds,
    companyId,
    fetchIntegrations,
    toggleExpand,
    handleAddNew,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    copyWebhookUrl,
    formatDate,
    handleFetchReceipts,
    handleSyncStatement,
    getCategoryIntegrations
  };
};
