import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { TableCell, TableRow } from '@/components/ui/table';
import { Transaction } from '../transactionsTypes';
import { TransactionGroup, nodeKey } from '@/lib/transactionGrouping';
import { formatDateTime } from '@/lib/formatDate';
import { SelectCell, TypeBadge, InfoCells, AmountValue, GroupAmountValue } from './tableCells';
import { getStatusDisplay, rowClassName } from './tableHelpers';
import TransactionChildRow from './TransactionChildRow';

interface TransactionGroupRowProps {
  group: TransactionGroup;
  isExpanded: boolean;
  timezone: string;
  selectedKeys: Set<string>;
  onToggleExpand: (groupId: string) => void;
  onRowClick: (tx: Transaction) => void;
  onToggleSelect: (tx: Transaction) => void;
}

const linkButtonClass = (isReconciled: boolean, isManual: boolean) =>
  isReconciled
    ? 'h-7 gap-1.5 bg-success/10 text-success border-success/30 hover:bg-success/20 hover:text-success'
    : isManual
    ? 'h-7 gap-1.5 bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20'
    : 'h-7 gap-1.5 bg-info/10 text-info border-info/30 hover:bg-info/20 hover:text-info';

const TransactionGroupRow = ({
  group,
  isExpanded,
  timezone,
  selectedKeys,
  onToggleExpand,
  onRowClick,
  onToggleSelect
}: TransactionGroupRowProps) => {
  const [primary, ...rest] = group.items;
  const isMatched = group.items.length > 1;
  const isReconciled = group.status === 'reconciled';
  const isManual = group.status === 'manual';
  const isPrimarySelected = selectedKeys.has(nodeKey(primary));

  return (
    <Fragment>
      <TableRow className={rowClassName(isPrimarySelected)} onClick={() => onRowClick(primary)}>
        <SelectCell isSelected={isPrimarySelected} onToggle={() => onToggleSelect(primary)} />
        <TableCell>
          <TypeBadge type={primary.type} />
        </TableCell>
        <InfoCells tx={primary} dateText={formatDateTime(primary.occurred_at, timezone)} />
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
              className={linkButtonClass(isReconciled, isManual)}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(group.id);
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
          {isMatched ? <GroupAmountValue group={group} /> : <AmountValue tx={primary} />}
        </TableCell>
      </TableRow>
      {isMatched &&
        isExpanded &&
        rest.map((tx) => (
          <TransactionChildRow
            key={`${tx.type}-${tx.source}-${tx.id}`}
            tx={tx}
            isSelected={selectedKeys.has(nodeKey(tx))}
            dateText={formatDateTime(tx.occurred_at, timezone)}
            onRowClick={onRowClick}
            onToggleSelect={onToggleSelect}
          />
        ))}
    </Fragment>
  );
};

export default TransactionGroupRow;
