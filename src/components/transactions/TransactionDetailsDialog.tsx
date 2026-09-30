import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { Transaction } from './transactionsTypes';
import DetachButton from './DetachButton';
import { nodeKey } from '@/lib/transactionGrouping';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime as formatDateTimeTz, DEFAULT_TIMEZONE } from '@/lib/formatDate';
import { ofdOperationTypeLabel } from '@/lib/ofdOperationType';
import { transactionStatusLabel } from '@/lib/transactionStatus';
import { getLinkReason, linkReasonClassName } from '@/lib/linkReason';

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  relatedItems: Transaction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetach: (tx: Transaction) => void;
  detachingKey: string | null;
}

const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt_kassa: { icon: 'Receipt', label: 'Чек кассы', className: 'bg-info/10 text-info border-info/30' },
  receipt_order: { icon: 'Truck', label: 'Заказ', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  receipt_ofd: { icon: 'FileCheck', label: 'Чек ОФД', className: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
};


const TransactionDetailsDialog = ({ transaction, relatedItems, open, onOpenChange, onDetach, detachingKey }: TransactionDetailsDialogProps) => {
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
  const groupItems = [transaction, ...relatedItems];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Icon name={config.icon} size={22} />
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
              <div className="font-medium">
                {transaction.type === 'receipt_ofd' ? ofdOperationTypeLabel(transaction.status) : transactionStatusLabel(transaction.status)}
              </div>
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
            <div className="text-sm text-muted-foreground mb-1">
              {transaction.signed_amount !== null && transaction.signed_amount !== transaction.amount
                ? 'Вклад в выручку (с учётом возврата)'
                : 'Сумма'}
            </div>
            <div className={`text-2xl font-bold ${(transaction.signed_amount ?? 0) < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {formatAmount(transaction.signed_amount ?? transaction.amount)}
            </div>
            {transaction.signed_amount !== null && transaction.signed_amount !== transaction.amount && (
              <div className="text-xs text-muted-foreground mt-1">
                Сумма документа: {formatAmount(transaction.amount)}
              </div>
            )}
          </div>

          {transaction.webhook_history && transaction.webhook_history.length > 1 && (
            <>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Icon name="History" size={14} />
                  История статусов ({transaction.webhook_history.length} вебхуков)
                </div>
                <div className="space-y-1.5">
                  {transaction.webhook_history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-1.5">
                      <span className="font-medium">{transactionStatusLabel(h.status)}</span>
                      <span className="text-muted-foreground text-xs">{formatDateTimeTz(h.occurred_at, timezone, true)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div>
            <div className="text-sm text-muted-foreground mb-2">Связанные записи для сверки</div>
            {relatedItems.length > 0 ? (
              <div className="space-y-2">
                {relatedItems.map((item) => {
                  const itemConfig = typeConfig[item.type] || typeConfig.payment;
                  const reason = getLinkReason(item, groupItems);
                  return (
                    <div
                      key={`${item.type}-${item.source}-${item.id}`}
                      className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-lg p-4"
                    >
                      <Icon name={itemConfig.icon} size={20} className="text-success shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{item.title}</span>
                          <Badge variant="outline" className={`gap-1 ${linkReasonClassName[reason.kind]}`}>
                            <Icon name={reason.icon} size={12} />
                            {reason.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{reason.description}</div>
                      </div>
                      <DetachButton
                        onClick={() => onDetach(item)}
                        isLoading={detachingKey === nodeKey(item)}
                        withLabel
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg p-4">
                <Icon name="Unlink" size={20} className="text-muted-foreground shrink-0" />
                <div className="text-sm text-muted-foreground">
                  Связей не найдено — для платежа ещё нет пробитого чека, либо для чека нет второй записи с совпадающими фискальными данными
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