import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import IntegrationCard from './IntegrationCard';
import { Category, UserIntegration } from './integrationsPageTypes';

interface IntegrationsCategoryListProps {
  categories: Category[];
  userIntegrations: UserIntegration[];
  getCategoryIntegrations: (categorySlug: string) => UserIntegration[];
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  onEdit: (integration: UserIntegration) => void;
  onDeleteClick: (integration: UserIntegration) => void;
  onCopyWebhookUrl: (token: string) => void;
  formatDate: (dateStr: string | null) => string;
  loadingReceipts: number | null;
  loadingStatement: number | null;
  onFetchReceipts: (integrationId: number, days: number) => void;
  onSyncStatement: (integrationId: number) => void;
  onAddNew: () => void;
}

const IntegrationsCategoryList = ({
  categories,
  userIntegrations,
  getCategoryIntegrations,
  expandedIds,
  onToggleExpand,
  onEdit,
  onDeleteClick,
  onCopyWebhookUrl,
  formatDate,
  loadingReceipts,
  loadingStatement,
  onFetchReceipts,
  onSyncStatement,
  onAddNew
}: IntegrationsCategoryListProps) => {
  return (
    <>
      {categories.filter(c => getCategoryIntegrations(c.slug).length > 0).map((category) => {
        const categoryIntegrations = getCategoryIntegrations(category.slug);

        return (
          <div key={category.id}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name={category.icon as any} size={20} />
              <h3 className="text-xl font-semibold">{category.name}</h3>
            </div>

            {categoryIntegrations.length > 0 ? (
              <div className="grid gap-4 mb-6">
                {categoryIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    isExpanded={expandedIds.has(integration.id)}
                    onToggleExpand={onToggleExpand}
                    onEdit={onEdit}
                    onDeleteClick={onDeleteClick}
                    onCopyWebhookUrl={onCopyWebhookUrl}
                    formatDate={formatDate}
                    loadingReceipts={loadingReceipts}
                    loadingStatement={loadingStatement}
                    onFetchReceipts={onFetchReceipts}
                    onSyncStatement={onSyncStatement}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {userIntegrations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Icon name="Inbox" size={32} className="mx-auto mb-2 opacity-50" />
            <p className="mb-2">Пока нет подключённых интеграций</p>
            <Button onClick={onAddNew} variant="link">
              Добавить первую интеграцию
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default IntegrationsCategoryList;
