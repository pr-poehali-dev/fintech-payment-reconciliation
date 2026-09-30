import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Transaction, TransactionTotalsByType } from '@/components/transactions/transactionsTypes';
import { DateFilter } from '@/components/transactions/TransactionsFilters';
import functionUrls from '../../backend/func2url.json';

export const PAGE_SIZE = 50;

interface FeedFilters {
  dateFilter: DateFilter | null;
  searchQuery: string;
  showUnmatchedOnly: boolean;
  types?: string[] | null;
}

interface FeedResponse {
  success?: boolean;
  error?: string;
  transactions?: Transaction[];
  context_transactions?: Transaction[];
  totals_by_type?: TransactionTotalsByType;
  total_count?: number;
  next_offset?: number;
  has_more?: boolean;
}

const mergeUnique = (base: Transaction[], extra: Transaction[]) => {
  const keys = new Set(base.map((t) => `${t.type}:${t.source}:${t.id}`));
  return [...base, ...extra.filter((t) => !keys.has(`${t.type}:${t.source}:${t.id}`))];
};

/**
 * Лента реестра транзакций: фильтры применяются на сервере ко всей базе,
 * итоги плиток - по всем отфильтрованным записям, строки приходят порциями
 * по PAGE_SIZE (целыми группами) и догружаются при прокрутке.
 */
export const useTransactionsFeed = (
  companyId: number | undefined,
  filters: FeedFilters,
  onError: (message: string) => void
) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contextTransactions, setContextTransactions] = useState<Transaction[]>([]);
  const [totalsByType, setTotalsByType] = useState<TransactionTotalsByType>({});
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const nextOffsetRef = useRef(0);
  const transactionsCountRef = useRef(0);
  transactionsCountRef.current = transactions.length;
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const buildParams = (offset: number, limit: number) => {
    const { dateFilter, searchQuery, showUnmatchedOnly, types } = filtersRef.current;
    const params = new URLSearchParams({
      company_id: String(companyId),
      paged: '1',
      offset: String(offset),
      limit: String(limit)
    });
    if (dateFilter) {
      params.set('date_from', format(dateFilter.from, 'yyyy-MM-dd'));
      params.set('date_to', format(dateFilter.to, 'yyyy-MM-dd'));
    }
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (showUnmatchedOnly) params.set('unmatched_only', '1');
    if (types?.length) params.set('types', types.join(','));
    return params;
  };

  const request = async (offset: number, limit: number): Promise<FeedResponse | null> => {
    try {
      const response = await fetch(`${functionUrls['transactions-list']}?${buildParams(offset, limit)}`);
      const data: FeedResponse = await response.json();
      if (!response.ok || !data.success) {
        onErrorRef.current(data.error || 'Не удалось загрузить транзакции');
        return null;
      }
      return data;
    } catch {
      onErrorRef.current('Проверьте интернет-соединение');
      return null;
    }
  };

  // keepLoaded=true - обновление после действий (связать, разорвать, удалить,
  // кнопка «Обновить»): перечитываем столько же групп, сколько уже было
  // пролистано, чтобы список не «прыгал» в начало.
  const reload = useCallback(
    async (keepLoaded = false) => {
      if (!companyId) return;
      const requestId = ++requestIdRef.current;
      if (hasLoadedOnceRef.current) setIsRefreshing(true);
      else setIsLoading(true);

      const limit = keepLoaded ? Math.max(PAGE_SIZE, transactionsCountRef.current) : PAGE_SIZE;
      const data = await request(0, limit);
      if (requestId !== requestIdRef.current) return;

      if (data) {
        setTransactions(data.transactions || []);
        setContextTransactions(data.context_transactions || []);
        setTotalsByType(data.totals_by_type || {});
        setTotalCount(data.total_count || 0);
        setHasMore(Boolean(data.has_more));
        nextOffsetRef.current = data.next_offset || 0;
      }
      setIsLoading(false);
      setIsRefreshing(false);
      hasLoadedOnceRef.current = true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId]
  );

  const loadMore = useCallback(async () => {
    if (!companyId || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const requestId = requestIdRef.current;
    const data = await request(nextOffsetRef.current, PAGE_SIZE);
    if (requestId === requestIdRef.current && data) {
      setTransactions((prev) => mergeUnique(prev, data.transactions || []));
      setContextTransactions((prev) => mergeUnique(prev, data.context_transactions || []));
      setHasMore(Boolean(data.has_more));
      nextOffsetRef.current = data.next_offset || nextOffsetRef.current;
    }
    loadingMoreRef.current = false;
    setIsLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, hasMore]);

  const { dateFilter, searchQuery, showUnmatchedOnly, types } = filters;
  const typesKey = types?.join(',') ?? '';
  const dateKey = dateFilter ? `${dateFilter.from.toDateString()}-${dateFilter.to.toDateString()}` : '';

  useEffect(() => {
    if (!companyId) return;
    const delay = hasLoadedOnceRef.current ? 350 : 0;
    const timer = setTimeout(() => reload(false), delay);
    return () => clearTimeout(timer);
  }, [companyId, dateKey, searchQuery, showUnmatchedOnly, typesKey, reload]);

  // Все записи под текущими фильтрами (для выгрузки) - порциями, пока сервер
  // не скажет, что больше нет.
  const fetchAllFiltered = useCallback(async (): Promise<Transaction[] | null> => {
    if (!companyId) return null;
    const all: Transaction[] = [];
    let offset = 0;
    for (let i = 0; i < 200; i++) {
      const data = await request(offset, 500);
      if (!data) return null;
      all.push(...(data.transactions || []));
      if (!data.has_more) break;
      offset = data.next_offset || 0;
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return {
    fetchAllFiltered,
    transactions,
    contextTransactions,
    totalsByType,
    totalCount,
    hasMore,
    isLoading,
    isRefreshing,
    isLoadingMore,
    reload,
    loadMore
  };
};
