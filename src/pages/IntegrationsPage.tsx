import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import CopyScenarioDialog from '@/components/automation/CopyScenarioDialog';
import { UserIntegration } from '@/components/integrations/integrationsPageTypes';
import functionUrls from '../../backend/func2url.json';
import Icon from '@/components/ui/icon';
import AddIntegrationDialog from '@/components/integrations/AddIntegrationDialog';
import DeleteIntegrationDialog from '@/components/integrations/DeleteIntegrationDialog';
import IntegrationsCategoryList from '@/components/integrations/IntegrationsCategoryList';
import { useIntegrationsPageData } from '@/components/integrations/useIntegrationsPageData';

const IntegrationsPage = () => {
  const {
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
    handleSyncStatement,
    getCategoryIntegrations
  } = useIntegrationsPageData();
  const { toast } = useToast();
  const { companies, user, setCurrentCompanyId } = useAuth();
  const [toCopy, setToCopy] = useState<UserIntegration | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // Копия интеграции (те же ключи, свой адрес вебхука) - в эту или другую компанию пользователя.
  const handleCopy = async (targetCompanyId: number, name: string) => {
    if (!toCopy || !companyId) return;
    setIsCopying(true);
    try {
      const res = await fetch(functionUrls['integrations-create'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy', company_id: companyId, integration_id: toCopy.id,
          target_company_id: targetCompanyId, user_id: user?.user_id, integration_name: name
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Попробуйте ещё раз');
      const same = targetCompanyId === companyId;
      const targetName = companies.find((c) => c.id === targetCompanyId)?.name || 'выбранную компанию';
      setToCopy(null);
      toast({
        title: same ? 'Интеграция скопирована' : `Скопировано в «${targetName}»`,
        description: 'У копии свой адрес вебхука — если интеграция принимает хуки, добавьте новый адрес в сервисе',
        action: same ? undefined : (
          <ToastAction altText="Перейти в компанию" onClick={() => setCurrentCompanyId(targetCompanyId)}>Перейти</ToastAction>
        )
      });
      if (same) await fetchIntegrations();
    } catch (e) {
      toast({ title: 'Не удалось скопировать', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsCopying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Загрузка интеграций...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Интеграции</h2>
          <p className="text-muted-foreground">
            Подключено сервисов: {userIntegrations.length}
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Icon name="Plus" size={16} className="mr-2" />
          Добавить интеграцию
        </Button>
      </div>

      <IntegrationsCategoryList
        categories={categories}
        userIntegrations={userIntegrations}
        getCategoryIntegrations={getCategoryIntegrations}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
        onEdit={handleEdit}
        onDeleteClick={handleDeleteClick}
        onCopy={setToCopy}
        onCopyWebhookUrl={copyWebhookUrl}
        formatDate={formatDate}
        loadingStatement={loadingStatement}
        onSyncStatement={handleSyncStatement}
        onAddNew={handleAddNew}
      />

      <AddIntegrationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        categories={categories}
        initialCategory={null}
        editingIntegration={editingIntegration}
        allProviders={allProviders}
        connectedProviderIds={userIntegrations.map(ui => ui.provider_id)}
        companyId={companyId || 0}
        onSuccess={fetchIntegrations}
      />

      <CopyScenarioDialog
        scenario={toCopy ? { name: toCopy.integration_name } : null}
        title="Копировать интеграцию"
        hint="Скопируются все настройки и ключи доступа. У копии будет свой адрес вебхука."
        companies={companies}
        currentCompanyId={companyId ?? null}
        isCopying={isCopying}
        onOpenChange={(o) => !o && setToCopy(null)}
        onCopy={handleCopy}
      />

      <DeleteIntegrationDialog
        deletingIntegration={deletingIntegration}
        showDeleteDialog={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default IntegrationsPage;