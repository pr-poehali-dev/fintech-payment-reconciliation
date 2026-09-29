import { useState, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Transaction } from './transactionsTypes';
import { TransactionGroup } from '@/lib/transactionGrouping';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, DEFAULT_TIMEZONE } from '@/lib/formatDate';
import { ofdOperationTypeLabel, ofdOperationTypeColorClass } from '@/lib/ofdOperationType';

interface TransactionsTableProps {
  groups: TransactionGroup[];
  onRowClick: (transaction: Transaction) => void;
}

const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt_kassa: { icon: 'Receipt', label: 'Чек кассы', className: 'bg-info/10 text-info border-info/30' },
  receipt_order: { icon: 'Truck', label: 'Заказ', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  receipt_ofd: { icon: 'FileCheck', label: 'Чек ОФД', className: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
};

// Чек ОФД - отдельный случай: его status хранит сырой OperationType из 54-ФЗ
// (Income/Refund income/...), для него своя раскраска и подпись, см. ниже.
const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'CONFIRMED':
    case 'done':
    case 'in':
      return 'bg-success';
    case 'AUTHORIZED':
      return 'bg-info';
    case 'REJECTED':
    case 'fail':
      return 'bg-destructive';
    case 'REFUNDED':
    case 'out':
      return 'bg-warning';
    case 'CANCELED':
      return 'bg-muted-foreground';
    default:
      return 'bg-muted-foreground';
  }
};

// Единая точка получения цвета/подписи статуса с учётом типа транзакции -
// у чека ОФД status это OperationType (54-ФЗ), у остальных - обычный статус.
const getStatusDisplay = (tx: { type: string; status: string | null }) => {
  if (tx.type === 'receipt_ofd') {
    return { label: ofdOperationTypeLabel(tx.status), color: ofdOperationTypeColorClass(tx.status) };
  }
  return { label: tx.status, color: getStatusColor(tx.status) };
};

const TransactionsTable = ({ groups, onRowClick }: TransactionsTableProps) => {
  const { currentCompany } = useAuth();
  const timezone = currentCompany?.timezone || DEFAULT_TIMEZONE;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      signDisplay: 'exceptZero'
    }).format(amount);
  };

  // Знак суммы - это чистый вклад транзакции в выручку (возврат вычитается,
  // а не увеличивает итог), в отличие от amount - абсолютной величины
  // документа как она есть в исходных данных.
  const renderAmountCell = (tx: Transaction) => {
    const signed = tx.signed_amount ?? tx.amount;
    const isNegative = (signed ?? 0) < 0;
    const isZero = signed === 0 && tx.amount !== 0;
    return (
      <div className={isNegative ? 'text-destructive' : isZero ? 'text-muted-foreground' : ''}>
        {formatAmount(signed)}
        {isZero && <div className="text-xs font-normal text-muted-foreground">возврат, эффект 0</div>}
      </div>
    );
  };

  const toggleExpand = (groupId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const renderRow = (tx: Transaction, isSecondary: boolean) => {
    const config = typeConfig[tx.type] || typeConfig.payment;
    return (
      <TableRow
        key={`${tx.type}-${tx.source}-${tx.id}`}
        className={`cursor-pointer hover:bg-muted/50 ${isSecondary ? 'bg-muted/20' : ''}`}
        onClick={() => onRowClick(tx)}
      >
        <TableCell className={isSecondary ? 'pl-10' : ''}>
          {isSecondary && <Icon name="CornerDownRight" size={13} className="inline mr-1.5 text-muted-foreground" />}
          <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
            <Icon name={config.icon as any} size={12} />
            {config.label}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(tx.occurred_at, timezone)}
        </TableCell>
        <TableCell>
          <div className="text-sm font-medium">{tx.title}</div>
          {tx.subtitle && (
            <div className="text-xs text-muted-foreground">{tx.subtitle}</div>
          )}
        </TableCell>
        <TableCell className="text-sm">
          {tx.integration_name || '—'}
        </TableCell>
        <TableCell>
          {tx.status && (
            <Badge className={`${getStatusDisplay(tx).color} text-white`}>
              {getStatusDisplay(tx).label}
            </Badge>
          )}
        </TableCell>
        <TableCell />
        <TableCell className="text-right font-semibold">
          {renderAmountCell(tx)}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Тип</TableHead>
            <TableHead>Дата и время</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead>Интеграция</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Связь</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Транзакции не найдены
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              const [primary, ...rest] = group.items;
              const isMatched = group.items.length > 1;
              const isReconciled = group.status === 'reconciled';
              const isExpanded = expanded.has(group.id);
              const config = typeConfig[primary.type] || typeConfig.payment;

              return (
                <Fragment key={group.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onRowClick(primary)}
                  >
                    <TableCell>
                      <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
                        <Icon name={config.icon as any} size={12} />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(primary.occurred_at, timezone)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{primary.title}</div>
                      {primary.subtitle && (
                        <div className="text-xs text-muted-foreground">{primary.subtitle}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {primary.integration_name || '—'}
                    </TableCell>
                    <TableCell>
                      {primary.status && (
                        <Badge className={`${getStatusDisplay(primary).color} text-white`}>
                          {getStatusDisplay(primary).label}
                        </Badge>
                      )}
                      {primary.webhook_history && primary.webhook_history.length > 1 && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Icon name="History" size={11} />
                          {primary.webhook_history.length} статусов
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isMatched ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className={
                            isReconciled
                              ? 'h-7 gap-1.5 bg-success/10 text-success border-success/30 hover:bg-success/20 hover:text-success'
                              : 'h-7 gap-1.5 bg-info/10 text-info border-info/30 hover:bg-info/20 hover:text-info'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(group.id);
                          }}
                        >
                          <Icon name={isReconciled ? 'ShieldCheck' : 'Link2'} size={12} />
                          {isReconciled ? 'Сверено' : 'Связано'} ({group.items.length})
                          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={12} />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                          <Icon name="Unlink" size={12} />
                          Нет пары
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {renderAmountCell(primary)}
                    </TableCell>
                  </TableRow>
                  {isMatched && isExpanded && rest.map((tx) => renderRow(tx, true))}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TransactionsTable;