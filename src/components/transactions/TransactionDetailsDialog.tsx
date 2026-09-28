import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { Transaction } from './transactionsTypes';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime as formatDateTimeTz, DEFAULT_TIMEZONE } from '@/lib/formatDate';

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  relatedItems: Transaction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt: { icon: 'Receipt', label: 'Чек', className: 'bg-info/10 text-info border-info/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
};

const matchMethodLabels: Record<string, string> = {
  receipt_id: 'Чек привязан при обработке вебхука шлюза Екомкассы',
  order_id: 'Совпал номер заказа / внешний ID платежа и чека',
  fiscal_triplet: 'Совпали фискальные реквизиты: ФН + номер ФД + ФПД'
};

const TransactionDetailsDialog = ({ transaction, relatedItems, open, onOpenChange }: TransactionDetailsDialogProps) => {
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
            <div className="text-sm text-muted-foreground mb-2">Связанные записи для сверки</div>
            {relatedItems.length > 0 ? (
              <div className="space-y-2">
                {relatedItems.map((item) => {
                  const itemConfig = typeConfig[item.type] || typeConfig.payment;
                  const reason = matchMethodLabels[transaction.match_method || item.match_method || ''] || 'Связано';
                  return (
                    <div
                      key={`${item.type}-${item.source}-${item.id}`}
                      className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-lg p-4"
                    >
                      <Icon name={itemConfig.icon as any} size={20} className="text-success shrink-0" />
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">{reason}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-4">
                <Icon name="Unlink" size={20} className="text-muted-foreground shrink-0" />
                <div className="text-sm text-muted-foreground">
                  Пара не найдена — для платежа ещё нет пробитого чека, либо для чека нет второй записи с совпадающими фискальными данными
                </div>
              </div>
            )}
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