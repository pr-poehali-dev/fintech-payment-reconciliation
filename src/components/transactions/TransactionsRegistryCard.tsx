import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import TransactionsTable from '@/components/transactions/TransactionsTable';
import TransactionsFilters, { DateFilter } from '@/components/transactions/TransactionsFilters';
import { Transaction } from '@/components/transactions/transactionsTypes';
import { TransactionGroup } from '@/lib/transactionGrouping';

interface TransactionsRegistryCardProps {
  groups: TransactionGroup[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  dateFilter: DateFilter | null;
  setDateFilter: (value: DateFilter | null) => void;
  showUnmatchedOnly: boolean;
  setShowUnmatchedOnly: (value: boolean) => void;
  selectedTxByKey: Map<string, Transaction>;
  isLinking: boolean;
  onLink: () => void;
  onDeleteClick: () => void;
  onClearSelection: () => void;
  onRowClick: (tx: Transaction) => void;
  onToggleSelect: (tx: Transaction) => void;
}

const TransactionsRegistryCard = ({
  groups,
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  showUnmatchedOnly,
  setShowUnmatchedOnly,
  selectedTxByKey,
  isLinking,
  onLink,
  onDeleteClick,
  onClearSelection,
  onRowClick,
  onToggleSelect
}: TransactionsRegistryCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Реестр транзакций</CardTitle>
        <CardDescription>
          Каждая строка — уже готовая для сверки запись: платёж, чек или банковская операция
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <TransactionsFilters
            searchQuery={searchQuery}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            setSearchQuery={setSearchQuery}
            showUnmatchedOnly={showUnmatchedOnly}
            setShowUnmatchedOnly={setShowUnmatchedOnly}
          />
          {selectedTxByKey.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Выбрано: {selectedTxByKey.size}</span>
              {selectedTxByKey.size >= 2 && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onLink} disabled={isLinking}>
                  <Icon name={isLinking ? 'Loader2' : 'Link2'} size={14} className={isLinking ? 'animate-spin' : ''} />
                  Связать
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={onDeleteClick}
              >
                <Icon name="Trash2" size={14} />
                Удалить
              </Button>
              <Button size="sm" variant="ghost" onClick={onClearSelection}>
                Отменить
              </Button>
            </div>
          )}
        </div>

        <TransactionsTable
          groups={groups}
          onRowClick={onRowClick}
          selectedKeys={new Set(selectedTxByKey.keys())}
          onToggleSelect={onToggleSelect}
        />
      </CardContent>
    </Card>
  );
};

export default TransactionsRegistryCard;
