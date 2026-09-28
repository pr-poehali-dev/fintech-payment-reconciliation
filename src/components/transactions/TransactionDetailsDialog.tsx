import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { Transaction } from './transactionsTypes';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime as formatDateTimeTz, DEFAULT_TIMEZONE } from '@/lib/formatDate';

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt: { icon: 'Receipt', label: 'Чек', className: 'bg-info/10 text-info border-info/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
};

const TransactionDetailsDialog = ({ transaction, open, onOpenChange }: TransactionDetailsDialogProps) => {
  const { currentCompany } = useAuth();
  const timezone = currentCompany?.timezone || DEFAULT_TIMEZONE;

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!transaction) return null;

  const config = typeConfig[transaction.type] || typeConfig.payment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Icon name={config.icon as any} size={22} />
            {transaction.title}
          </DialogTitle>
          <DialogDescription>
            Подробная информация о транзакции, собранной для сверки
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pr-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Тип</div>
              <Badge variant="outline" className={config.className}>{config.label}</Badge>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Статус</div>
              <div className="font-medium">{transaction.status || '—'}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Интеграция</div>
              <div className="font-medium">{transaction.integration_name || '—'}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Источник / провайдер</div>
              <div className="font-medium">{transaction.subtitle || '—'}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Референс / номер заказа</div>
              <div className="font-mono text-sm">{transaction.reference || '—'}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Дата и время</div>
              <div className="font-medium">{formatDateTimeTz(transaction.occurred_at, timezone, true)}</div>
            </div>
          </div>

          <Separator />

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Сумма</div>
            <div className="text-2xl font-bold text-foreground">
              {formatAmount(transaction.amount)}
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-lg font-semibold mb-3">Исходные данные</div>
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(transaction.raw_data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionDetailsDialog;
