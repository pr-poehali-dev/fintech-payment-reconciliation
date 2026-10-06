import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { Transaction } from '../transactionsTypes';
import { TransactionGroup, nodeKey } from '@/lib/transactionGrouping';
import { formatTxDateTime } from '@/lib/formatDate';
import { TypeBadge, AmountValue, GroupAmountValue } from './tableCells';
import { getStatusDisplay } from './tableHelpers';
import DetachButton from '../DetachButton';

interface TransactionsMobileListProps {
  groups: TransactionGroup[];
  timezone: string;
  selectedKeys: Set<string>;
  onRowClick: (tx: Transaction) => void;
  onToggleSelect: (tx: Transaction) => void;
  onDetach: (tx: Transaction) => void;
  detachingKey: string | null;
}

const TxCard = ({
  tx, timezone, selected, onRowClick, onToggleSelect, amount, nested, footer
}: {
  tx: Transaction;
  timezone: string;
  selected: boolean;
  onRowClick: (tx: Transaction) => void;
  onToggleSelect: (tx: Transaction) => void;
  amount: React.ReactNode;
  nested?: boolean;
  footer?: React.ReactNode;
}) => {
  const st = tx.status ? getStatusDisplay(tx) : null;
  return (
    <div
      onClick={() => onRowClick(tx)}
      className={`cursor-pointer p-3 transition-colors active:bg-muted/50 ${selected ? 'bg-primary/5' : ''} ${nested ? 'border-t border-border bg-muted/20 pl-4' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(tx)} aria-label="Выбрать транзакцию" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {nested && <Icon name="CornerDownRight" size={13} className="text-muted-foreground" />}
              <TypeBadge type={tx.type} />
              {st && <Badge className={`${st.color} text-white`}>{st.label}</Badge>}
            </div>
            <div className="shrink-0 text-right text-sm font-semibold">{amount}</div>
          </div>
          <div className="mt-1.5 break-words text-sm font-medium [overflow-wrap:anywhere]">{tx.title}</div>
          {tx.subtitle && <div className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{tx.subtitle}</div>}
          <div className="mt-1 text-xs text-muted-foreground">
            {formatTxDateTime(tx.occurred_at, tx.type, timezone)}
            {tx.integration_name && ` · ${tx.integration_name}`}
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
};

const TransactionsMobileList = ({
  groups, timezone, selectedKeys, onRowClick, onToggleSelect, onDetach, detachingKey
}: TransactionsMobileListProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (groups.length === 0) {
    return <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">Транзакции не найдены</div>;
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const [primary, ...rest] = group.items;
        const isMatched = group.items.length > 1;
        const isReconciled = group.status === 'reconciled';
        const isManual = group.status === 'manual';
        const isOpen = expanded.has(group.id);
        return (
          <div key={group.id} className={`overflow-hidden rounded-lg border ${isReconciled ? 'border-success/40' : 'border-border'}`}>
            <TxCard
              tx={primary}
              timezone={timezone}
              selected={selectedKeys.has(nodeKey(primary))}
              onRowClick={onRowClick}
              onToggleSelect={onToggleSelect}
              amount={isMatched ? <GroupAmountValue group={group} /> : <AmountValue tx={primary} />}
              footer={
                <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {isMatched ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 gap-1.5 ${
                          isReconciled
                            ? 'border-success/30 bg-success/10 text-success'
                            : isManual
                              ? 'border-violet-500/30 bg-violet-500/10 text-violet-400'
                              : 'border-info/30 bg-info/10 text-info'
                        }`}
                        onClick={() => toggle(group.id)}
                      >
                        <Icon name={isReconciled ? 'ShieldCheck' : isManual ? 'Magnet' : 'Link2'} size={12} />
                        {isReconciled ? 'Сверено' : 'Связано'}: {group.items.length}
                        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={12} />
                      </Button>
                      <DetachButton onClick={() => onDetach(primary)} isLoading={detachingKey === nodeKey(primary)} />
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="Unlink" size={12} />
                      Нет связей
                    </span>
                  )}
                </div>
              }
            />
            {isMatched && isOpen && rest.map((tx) => (
              <TxCard
                key={`${tx.type}-${tx.source}-${tx.id}`}
                tx={tx}
                nested
                timezone={timezone}
                selected={selectedKeys.has(nodeKey(tx))}
                onRowClick={onRowClick}
                onToggleSelect={onToggleSelect}
                amount={<AmountValue tx={tx} />}
                footer={
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <DetachButton onClick={() => onDetach(tx)} isLoading={detachingKey === nodeKey(tx)} withLabel />
                  </div>
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default TransactionsMobileList;
