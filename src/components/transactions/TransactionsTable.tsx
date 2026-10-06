import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Transaction } from './transactionsTypes';
import { TransactionGroup } from '@/lib/transactionGrouping';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_TIMEZONE } from '@/lib/formatDate';
import TransactionGroupRow from './table/TransactionGroupRow';
import TransactionsMobileList from './table/TransactionsMobileList';

interface TransactionsTableProps {
  groups: TransactionGroup[];
  onRowClick: (transaction: Transaction) => void;
  selectedKeys: Set<string>;
  onToggleSelect: (tx: Transaction) => void;
  onDetach: (tx: Transaction) => void;
  detachingKey: string | null;
}

const TransactionsTable = ({ groups, onRowClick, selectedKeys, onToggleSelect, onDetach, detachingKey }: TransactionsTableProps) => {
  const { currentCompany } = useAuth();
  const timezone = currentCompany?.timezone || DEFAULT_TIMEZONE;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (groupId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <>
    <div className="md:hidden">
      <TransactionsMobileList
        groups={groups}
        timezone={timezone}
        selectedKeys={selectedKeys}
        onRowClick={onRowClick}
        onToggleSelect={onToggleSelect}
        onDetach={onDetach}
        detachingKey={detachingKey}
      />
    </div>
    <div className="hidden border rounded-lg overflow-x-auto md:block">
      <Table className="min-w-[720px]">
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
            groups.map((group) => (
              <TransactionGroupRow
                key={group.id}
                group={group}
                isExpanded={expanded.has(group.id)}
                timezone={timezone}
                selectedKeys={selectedKeys}
                onToggleExpand={toggleExpand}
                onRowClick={onRowClick}
                onToggleSelect={onToggleSelect}
                onDetach={onDetach}
                detachingKey={detachingKey}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
    </>
  );
};

export default TransactionsTable;
