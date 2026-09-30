import { useEffect, useRef } from 'react';
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
  onDetach: (tx: Transaction) => void;
  detachingKey: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  totalCount: number;
  loadedCount: number;
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
  onToggleSelect,
  onDetach,
  detachingKey,
  hasMore,
  isLoadingMore,
  onLoadMore,
  totalCount,
  loadedCount
}: TransactionsRegistryCardProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, loadedCount]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Реестр транзакций</CardTitle>
        <CardDescription>
          Каждая строка — уже готовая для сверки запись: платёж, чек или банковская операция
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 overflow-x-auto p-0.5">
          <TransactionsFilters
            searchQuery={searchQuery}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            setSearchQuery={setSearchQuery}
            showUnmatchedOnly={showUnmatchedOnly}
            setShowUnmatchedOnly={setShowUnmatchedOnly}
          />
          {selectedTxByKey.size > 0 && (
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Выбрано: {selectedTxByKey.size}</span>
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
          onDetach={onDetach}
          detachingKey={detachingKey}
        />

        <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground">
          {totalCount > 0 && (
            <span>
              Показано {Math.min(loadedCount, totalCount)} из {totalCount}
            </span>
          )}
          {hasMore && (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={onLoadMore} disabled={isLoadingMore}>
              <Icon name={isLoadingMore ? 'Loader2' : 'ChevronsDown'} size={14} className={isLoadingMore ? 'animate-spin' : ''} />
              {isLoadingMore ? 'Загружаю…' : 'Показать ещё'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionsRegistryCard;
