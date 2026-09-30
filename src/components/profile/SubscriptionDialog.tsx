import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { SUBSCRIPTION_STATUS, subscriptionEndDate, daysLeft, formatLongDate } from '@/lib/subscription';

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  const status = SUBSCRIPTION_STATUS[currentCompany?.subscription_status || ''] || {
    label: currentCompany?.subscription_status || 'Нет подписки',
    className: 'bg-muted text-muted-foreground border-border'
  };
  const isTrial = currentCompany?.subscription_status === 'trial';
  const endDate = subscriptionEndDate(currentCompany);
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
              <Row icon="CalendarClock" label={isTrial ? 'Пробный период до' : 'Оплачено до'} value={formatLongDate(endDate)} />
              <Row icon="Users" label="Пользователей в тарифе" value={currentCompany.max_users ?? 'Без ограничений'} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionDialog;
