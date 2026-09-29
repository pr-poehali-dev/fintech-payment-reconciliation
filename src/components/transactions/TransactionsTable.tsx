import { useState, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { TransactionGroup, nodeKey } from '@/lib/transactionGrouping';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, DEFAULT_TIMEZONE } from '@/lib/formatDate';
import { ofdOperationTypeLabel, ofdOperationTypeColorClass } from '@/lib/ofdOperationType';
import { transactionStatusLabel, transactionStatusColor } from '@/lib/transactionStatus';

interface TransactionsTableProps {
  groups: TransactionGroup[];
  onRowClick: (transaction: Transaction) => void;
  selectedKeys: Set<string>;
  onToggleSelect: (tx: Transaction) => void;
}

const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt_kassa: { icon: 'Receipt', label: 'Чек кассы', className: 'bg-info/10 text-info border-info/30' },
  receipt_order: { icon: 'Truck', label: 'Заказ', className: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  receipt_ofd: { icon: 'FileCheck', label: 'Чек ОФД', className: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
};

// Единая точка получения цвета/подписи статуса с учётом типа транзакции -
// у чека ОФД status это OperationType (54-ФЗ, свой словарь), у остальных -
// обычный статус платежа/кассы (см. lib/transactionStatus.ts).
const getStatusDisplay = (tx: { type: string; status: string | null }) => {
  if (tx.type === 'receipt_ofd') {
    return { label: ofdOperationTypeLabel(tx.status), color: ofdOperationTypeColorClass(tx.status) };
  }
  return { label: transactionStatusLabel(tx.status), color: transactionStatusColor(tx.status) };
};

const TransactionsTable = ({ groups, onRowClick, selectedKeys, onToggleSelect }: TransactionsTableProps) => {
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

  // Итог по группе - считается на уровне группы (по каждой реальной сделке
  // один раз, см. transactionGrouping.ts/computeTotal), а не берётся от
  // одной "главной" строки - иначе, например, ручная склейка продажи и
  // отдельного возврата в одну группу показала бы сумму только продажи.
  const renderGroupAmountCell = (group: TransactionGroup) => {
    const total = group.totalAmount;
    const isNegative = total < 0;
    const isZero = total === 0 && group.items.length > 1;
    return (
      <div className={isNegative ? 'text-destructive' : isZero ? 'text-muted-foreground' : ''}>
        {formatAmount(total)}
        {isZero && <div className="text-xs font-normal text-muted-foreground">взаимно погашено</div>}
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
    const isSelected = selectedKeys.has(nodeKey(tx));
    return (
      <TableRow
        key={`${tx.type}-${tx.source}-${tx.id}`}
        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'} ${isSecondary ? 'bg-muted/20' : ''}`}
        onClick={() => onRowClick(tx)}
      >
        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
          <div
            className={`transition-all duration-150 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(tx)}
              aria-label="Выбрать транзакцию"
            />
          </div>
        </TableCell>
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
            <TableHead className="w-10" />
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
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Транзакции не найдены
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => {
              const [primary, ...rest] = group.items;
              const isMatched = group.items.length > 1;
              const isReconciled = group.status === 'reconciled';
              const isManual = group.status === 'manual';
              const isExpanded = expanded.has(group.id);
              const config = typeConfig[primary.type] || typeConfig.payment;
              const isPrimarySelected = selectedKeys.has(nodeKey(primary));

              return (
                <Fragment key={group.id}>
                  <TableRow
                    className={`group cursor-pointer transition-colors ${isPrimarySelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'}`}
                    onClick={() => onRowClick(primary)}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <div
                        className={`transition-all duration-150 ${isPrimarySelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}
                      >
                        <Checkbox
                          checked={isPrimarySelected}
                          onCheckedChange={() => onToggleSelect(primary)}
                          aria-label="Выбрать транзакцию"
                        />
                      </div>
                    </TableCell>
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
                        <Badge className={`${isReconciled ? 'bg-success' : getStatusDisplay(primary).color} text-white`}>
                          {isReconciled ? 'Сверено' : getStatusDisplay(primary).label}
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
                              : isManual
                              ? 'h-7 gap-1.5 bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20'
                              : 'h-7 gap-1.5 bg-info/10 text-info border-info/30 hover:bg-info/20 hover:text-info'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(group.id);
                          }}
                        >
                          <Icon name={isReconciled ? 'ShieldCheck' : isManual ? 'Magnet' : 'Link2'} size={12} />
                          {group.items.length}
                          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={12} />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                          <Icon name="Unlink" size={12} />
                          Нет связей
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {isMatched ? renderGroupAmountCell(group) : renderAmountCell(primary)}
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