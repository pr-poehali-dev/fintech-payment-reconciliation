import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import functionUrls from '../../../backend/func2url.json';
import { PURPOSE_CATEGORY_LABELS, UserIntegration } from './integrationsPageTypes';

interface IntegrationCardProps {
  integration: UserIntegration;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
  onEdit: (integration: UserIntegration) => void;
  onDeleteClick: (integration: UserIntegration) => void;
  onCopyWebhookUrl: (token: string) => void;
  formatDate: (dateStr: string | null) => string;
  loadingReceipts: number | null;
  loadingStatement: number | null;
  onFetchReceipts: (integrationId: number, days: number) => void;
  onSyncStatement: (integrationId: number) => void;
}

const IntegrationCard = ({
  integration,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDeleteClick,
  onCopyWebhookUrl,
  formatDate,
  loadingReceipts,
  loadingStatement,
  onFetchReceipts,
  onSyncStatement
}: IntegrationCardProps) => {
  const isOFD = integration.category_slug === 'ofd';
  const isBank = integration.category_slug === 'banks';
  const isCrm = integration.category_slug === 'crm';

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => onToggleExpand(integration.id)}
        className="w-full text-left"
      >
        <CardHeader className="hover:bg-muted/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Icon
                name="ChevronRight"
                size={18}
                className={`text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">{integration.integration_name}</CardTitle>
                <CardDescription className="truncate">{integration.provider_name}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={
                  integration.status === 'active'
                    ? 'border-success/40 text-success bg-success/10'
                    : 'border-muted-foreground/30 text-muted-foreground bg-transparent'
                }
              >
                {integration.status === 'active' ? 'Подключено' : 'Неактивно'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </button>
      {isExpanded && (
      <CardContent className="space-y-3 pt-0 animate-fade-in">
        <div className="flex justify-end gap-2 -mt-1 mb-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(integration)}
          >
            <Icon name="Settings" size={16} className="mr-1" />
            Настроить
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteClick(integration)}
          >
            <Icon name="Trash2" size={16} />
          </Button>
        </div>
        {isOFD ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ИНН:</span>
              <span className="font-medium font-mono">{integration.config?.inn || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">РНМ:</span>
              <span className="font-medium font-mono">{integration.config?.kkt || '—'}</span>
            </div>
            <div className="pt-2 space-y-2">
              <div className="text-xs text-muted-foreground mb-1">
                <Icon name="Download" size={12} className="inline mr-1" />
                Загрузить чеки
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[1, 7, 30, 60, 90].map((days) => (
                  <Button
                    key={days}
                    onClick={() => onFetchReceipts(integration.id, days)}
                    disabled={loadingReceipts === integration.id}
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 h-8"
                  >
                    {loadingReceipts === integration.id ? (
                      <Icon name="Loader2" className="animate-spin" size={12} />
                    ) : (
                      `${days === 1 ? 'Вчера' : days + 'д'}`
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : isBank ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Счёт:</span>
              <span className="font-medium font-mono">{integration.config?.account_number || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Последняя синхронизация:</span>
              <span className="font-medium">{formatDate(integration.last_synced_at ?? null)}</span>
            </div>
            {integration.sync_interval_hours && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Периодичность:</span>
                <span className="font-medium">
                  {integration.sync_interval_hours === 12 ? '2 раза в сутки' : '1 раз в сутки'}
                </span>
              </div>
            )}
            {Array.isArray(integration.config?.purpose_categories) && integration.config.purpose_categories.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Учитываем: </span>
                <span className="font-medium">
                  {integration.config.purpose_categories
                    .map((c: string) => PURPOSE_CATEGORY_LABELS[c] || c)
                    .join(', ')}
                </span>
              </div>
            )}
            <div className="pt-1">
              <Button
                onClick={() => onSyncStatement(integration.id)}
                disabled={loadingStatement === integration.id}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {loadingStatement === integration.id ? (
                  <Icon name="Loader2" className="animate-spin mr-2" size={14} />
                ) : (
                  <Icon name="RefreshCw" size={14} className="mr-2" />
                )}
                Синхронизировать сейчас
              </Button>
            </div>
          </>
        ) : (
          <>
            {isCrm && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Обновляется:</span>
                <span className="font-medium">по вебхуку от CRM</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Последний вебхук:</span>
              <span className="font-medium">{formatDate(integration.last_webhook_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Всего вебхуков:</span>
              <span className="font-medium">{integration.webhook_count}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-muted-foreground">Webhook URL:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyWebhookUrl(integration.webhook_token)}
                >
                  <Icon name="Copy" size={14} />
                </Button>
              </div>
              <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                {`${functionUrls['webhook-receive']}?token=${integration.webhook_token}`}
              </code>
            </div>
            {integration.forward_url && (
              <div className="text-sm">
                <span className="text-muted-foreground">Переадресация: </span>
                <span className="font-mono text-xs">{integration.forward_url}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
      )}
    </Card>
  );
};

export default IntegrationCard;
