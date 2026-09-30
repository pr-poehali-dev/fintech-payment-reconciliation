import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  trial: { label: 'Пробный период', className: 'bg-info/15 text-info border-info/30' },
  active: { label: 'Активна', className: 'bg-success/15 text-success border-success/30' },
  past_due: { label: 'Ожидает оплаты', className: 'bg-warning/15 text-warning border-warning/30' },
  canceled: { label: 'Отменена', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  expired: { label: 'Истекла', className: 'bg-destructive/15 text-destructive border-destructive/30' }
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const daysLeft = (iso?: string | null) => {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return diff;
};

const Row = ({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon name={icon} size={16} />
      {label}
    </span>
    <span className="text-sm font-medium text-right">{value}</span>
  </div>
);

const SubscriptionDialog = ({ open, onOpenChange }: SubscriptionDialogProps) => {
  const { currentCompany } = useAuth();
  const status = STATUS_LABELS[currentCompany?.subscription_status || ''] || {
    label: currentCompany?.subscription_status || 'Нет подписки',
    className: 'bg-muted text-muted-foreground border-border'
  };
  const isTrial = currentCompany?.subscription_status === 'trial';
  const endDate = isTrial ? currentCompany?.trial_ends_at : currentCompany?.current_period_end;
  const left = daysLeft(endDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подписка</DialogTitle>
          <DialogDescription>
            {currentCompany ? `Тариф компании «${currentCompany.name}»` : 'Компания не выбрана'}
          </DialogDescription>
        </DialogHeader>

        {currentCompany && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Текущий тариф</div>
                  <div className="text-xl font-display font-bold">{currentCompany.tariff_name || '—'}</div>
                </div>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
              </div>
              {left !== null && (
                <div className={`mt-3 text-sm font-medium ${left <= 3 ? 'text-warning' : 'text-primary'}`}>
                  {left > 0 ? `Осталось дней: ${left}` : 'Срок закончился'}
                </div>
              )}
            </div>

            <div className="divide-y divide-border">
              <Row icon="CalendarClock" label={isTrial ? 'Пробный период до' : 'Оплачено до'} value={formatDate(endDate)} />
              <Row icon="Users" label="Пользователей в тарифе" value={currentCompany.max_users ?? 'Без ограничений'} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
