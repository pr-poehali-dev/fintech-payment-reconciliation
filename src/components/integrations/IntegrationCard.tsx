import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { UserIntegration } from './integrationsPageTypes';

interface IntegrationCardProps {
  integration: UserIntegration;
  onEdit: (integration: UserIntegration) => void;
  onDeleteClick: (integration: UserIntegration) => void;
  onCopyWebhookUrl: (token: string) => void;
  formatDate: (dateStr: string | null) => string;
  loadingStatement: number | null;
  onSyncStatement: (integrationId: number) => void;
}

const Chip = ({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'warning' | 'primary' }) => {
  const cls =
    tone === 'warning'
      ? 'bg-amber-500/15 text-amber-500'
      : tone === 'primary'
        ? 'bg-primary/15 text-primary'
        : 'bg-muted';
  return <span className={`rounded-md px-2 py-1 ${cls}`}>{children}</span>;
};

const IntegrationCard = ({
  integration,
  onEdit,
  onDeleteClick,
  onCopyWebhookUrl,
  formatDate,
  loadingStatement,
  onSyncStatement
}: IntegrationCardProps) => {
  const isOFD = integration.category_slug === 'ofd';
  const isBank = integration.category_slug === 'banks';
  const isCrm = integration.category_slug === 'crm';
  const isEcomkassa = integration.provider_slug === 'ecomkassa';
  const isActive = integration.status === 'active';
  const usesWebhook = !isEcomkassa && !isOFD && !isBank;
  const cfg = integration.config || {};
  const syncing = loadingStatement === integration.id;

  const stop = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };

  return (
    <Card
      onClick={() => onEdit(integration)}
      className={`cursor-pointer transition-colors hover:border-primary/40 ${isActive ? '' : 'opacity-60'}`}
    >
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{integration.integration_name}</div>
            <div className="truncate text-xs text-muted-foreground">{integration.provider_name}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge
              variant="outline"
              className={isActive ? 'border-success/30 bg-success/15 text-success' : 'text-muted-foreground'}
            >
              {isActive ? 'Подключено' : 'Неактивно'}
            </Badge>
            {isBank && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                title="Синхронизировать сейчас"
                disabled={syncing}
                onClick={(e) => stop(e, () => onSyncStatement(integration.id))}
              >
                <Icon name={syncing ? 'Loader2' : 'RefreshCw'} size={16} className={syncing ? 'animate-spin' : ''} />
              </Button>
            )}
            {usesWebhook && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                title="Скопировать Webhook URL"
                onClick={(e) => stop(e, () => onCopyWebhookUrl(integration.webhook_token))}
              >
                <Icon name="Link" size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Удалить"
              onClick={(e) => stop(e, () => onDeleteClick(integration))}
            >
              <Icon name="Trash2" size={16} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {isEcomkassa && (
            <>
              <Chip>Магазин: {String(cfg.store_id || '—')}</Chip>
              <Chip>Протокол {String(cfg.protocol_version || 'v4')}</Chip>
              <Chip>Загрузка: {formatDate(integration.last_synced_at ?? null)}</Chip>
            </>
          )}
          {isOFD && (
            <>
              <Chip>ИНН: {String(cfg.inn || '—')}</Chip>
              <Chip>РНМ: {String(cfg.kkt || '—')}</Chip>
            </>
          )}
          {isBank && (
            <>
              {integration.provider_slug === 'tochka_account' && !cfg.account_number ? (
                <Chip tone="warning">Счёт не выбран — откройте настройки</Chip>
              ) : (
                <Chip>Счёт: {String(cfg.account_number || '—')}</Chip>
              )}
              <Chip>Синхронизация: {formatDate(integration.last_synced_at ?? null)}</Chip>
              {integration.sync_interval_hours ? (
                <Chip>{integration.sync_interval_hours === 12 ? '2 раза в сутки' : '1 раз в сутки'}</Chip>
              ) : null}
              {cfg.purpose_keywords && String(cfg.purpose_keywords).trim() ? (
                <Chip>Ключевые слова: {String(cfg.purpose_keywords)}</Chip>
              ) : null}
            </>
          )}
          {usesWebhook && (
            <>
              {isCrm && <Chip>По вебхуку от CRM</Chip>}
              <Chip>Последний вебхук: {formatDate(integration.last_webhook_at)}</Chip>
              <Chip>Вебхуков: {integration.webhook_count}</Chip>
              {integration.forward_url && <Chip tone="primary">Переадресация</Chip>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IntegrationCard;
