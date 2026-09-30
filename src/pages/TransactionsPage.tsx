import { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBackfill } from '@/contexts/BackfillContext';
import { DateFilter } from '@/components/transactions/TransactionsFilters';
import TransactionDetailsDialog from '@/components/transactions/TransactionDetailsDialog';
import DeleteTransactionsDialog from '@/components/transactions/DeleteTransactionsDialog';
import BackfillDialog from '@/components/transactions/BackfillDialog';
import TransactionsPageHeader from '@/components/transactions/TransactionsPageHeader';
import TransactionsSummaryCards from '@/components/transactions/TransactionsSummaryCards';
import TransactionsRegistryCard from '@/components/transactions/TransactionsRegistryCard';
import { Transaction, TransactionTotalsByType } from '@/components/transactions/transactionsTypes';
import { groupTransactions, computeMatchedKeys, nodeKey } from '@/lib/transactionGrouping';
import { filterTransactions } from '@/lib/transactionFilters';
import functionUrls from '../../backend/func2url.json';

interface IntegrationRow {
  id: number;
  integration_name: string;
  provider_slug: string;
  status: string;
}

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalsByType, setTotalsByType] = useState<TransactionTotalsByType>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [ecomkassaIntegrations, setEcomkassaIntegrations] = useState<{ id: number; name: string }[]>([]);
  const [ofdIntegrations, setOfdIntegrations] = useState<{ id: number; name: string }[]>([]);
  const [bankIntegrations, setBankIntegrations] = useState<{ id: number; name: string }[]>([]);
  const [selectedTxByKey, setSelectedTxByKey] = useState<Map<string, Transaction>>(new Map());
  const [isLinking, setIsLinking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detachingKey, setDetachingKey] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;
  const { openDialog, completedTick, phase: backfillPhase } = useBackfill();

  const fetchTransactions = async () => {
    if (!companyId) return;
    // isLoading используется только для ПЕРВОЙ загрузки страницы (полноэкранный
    // спиннер вместо контента). Повторные обновления (кнопка "Обновить",
    // дозагрузка из BackfillDialog) должны обновлять данные без размонтирования
    // страницы - иначе открытый поверх диалог дозагрузки исчезает вместе с ней.
    if (hasLoadedOnce) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams({
        company_id: String(companyId),
        limit: '200'
      });
      const response = await fetch(`${functionUrls['transactions-list']}?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setTransactions(data.transactions || []);
        setTotalsByType(data.totals_by_type || {});
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить транзакции',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        description: 'Проверьте интернет-соединение',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setHasLoadedOnce(true);
    }
  };

  // Список интеграций, доступных для дозагрузки (касса Екомкасса, ОФД,
  // расчётные счета) - вынесено в отдельную функцию, а не только в useEffect
  // при монтировании: только что подключённый банк (или ещё не завершённая
  // настройка - выбор счёта после ввода JWT-токена происходит отдельным
  // шагом) мог не попасть в список, загруженный раньше. Обновляем его заново
  // перед каждым открытием диалога дозагрузки (см. openBackfillDialog), чтобы
  // пользователь всегда видел актуальный набор источников.
  const fetchBackfillSources = () => {
    if (!companyId) return;
    fetch(`${functionUrls['integrations-list']}?company_id=${companyId}`)
      .then((res) => res.json())
      .then((data) => {
        const integrations: IntegrationRow[] = data.user_integrations || [];
        const pick = (slugs: string[]) =>
          integrations
            .filter((i) => slugs.includes(i.provider_slug) && i.status === 'active')
            .map((i) => ({ id: i.id, name: i.integration_name }));
        setEcomkassaIntegrations(pick(['ecomkassa']));
        setOfdIntegrations(pick(['ofdru']));
        setBankIntegrations(pick(['tbank_account', 'tochka_account']));
      })
      .catch(() => {});
  };

  const openBackfillDialog = () => {
    fetchBackfillSources();
    openDialog();
  };

  useEffect(() => {
    if (!companyId) return;

    // В платформе нет cron-планировщика для фоновых задач, поэтому дозагрузка
    // чеков шлюза Екомкассы (для платежей, чек которых ещё не был пробит на
    // момент вебхука) запускается автоматически при каждом открытии страницы -
    // без участия пользователя. Список обновится сам, если что-то довязалось.
    fetch(functionUrls['ecomkassa-gateway-resync'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.resolved > 0) fetchTransactions();
      })
      .catch(() => {});

    fetchTransactions();
    fetchBackfillSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // completedTick растёт в BackfillContext каждый раз, когда фоновая дозагрузка
  // (запущенная из BackfillDialog) завершается - в т.ч. если пользователь в
  // этот момент ушёл со страницы «Транзакции» и вернулся позже. Список должен
  // подхватить новые данные при каждом таком завершении.
  const isFirstCompletedTick = completedTick === 0;
  useEffect(() => {
    if (isFirstCompletedTick) return;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedTick]);

  const handleRowClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setShowDetails(true);
  };

  const handleToggleSelect = (tx: Transaction) => {
    setSelectedTxByKey((prev) => {
      const next = new Map(prev);
      const key = nodeKey(tx);
      if (next.has(key)) next.delete(key);
      else next.set(key, tx);
      return next;
    });
  };

  const clearSelection = () => setSelectedTxByKey(new Map());

  const handleLink = async () => {
    if (!companyId || selectedTxByKey.size < 2) return;
    setIsLinking(true);
    try {
      const items = Array.from(selectedTxByKey.values()).map((tx) => ({
        type: tx.type,
        source: tx.source,
        id: tx.id
      }));
      const response = await fetch(functionUrls['transactions-link'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, items })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: 'Связано', description: `Транзакции (${items.length}) объединены в одну группу` });
        clearSelection();
        fetchTransactions();
      } else {
        toast({
          title: 'Не удалось связать',
          description: data.error || 'Попробуйте ещё раз',
          variant: 'destructive'
        });
      }
    } catch {
      toast({ title: 'Ошибка подключения', description: 'Проверьте интернет-соединение', variant: 'destructive' });
    } finally {
      setIsLinking(false);
    }
  };

  // Вывод ОДНОЙ записи из группы (кнопка-магнит) - остальные участники
  // группы остаются связанными между собой.
  const handleDetach = async (tx: Transaction) => {
    if (!companyId) return;
    const key = nodeKey(tx);
    setDetachingKey(key);
    try {
      const response = await fetch(functionUrls['transactions-link'], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, mode: 'detach', item: { type: tx.type, source: tx.source, id: tx.id } })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Связь разорвана', description: `«${tx.title}» выведена из группы` });
        await fetchTransactions();
      } else {
        toast({ title: 'Не удалось разорвать связь', description: data.error || 'Попробуйте ещё раз', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', description: 'Проверьте интернет-соединение', variant: 'destructive' });
    } finally {
      setDetachingKey(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!companyId || selectedTxByKey.size === 0) return;
    setIsDeleting(true);
    try {
      const items = Array.from(selectedTxByKey.values()).map((tx) => ({ type: tx.type, id: tx.id }));
      const response = await fetch(functionUrls['transactions-remove'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, items })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        const skippedCount = data.skipped?.length || 0;
        toast({
          title: 'Удалено',
          description: skippedCount > 0
            ? `Удалено ${data.removed_count} из ${items.length} — часть записей уже не найдена`
            : `Удалено транзакций: ${data.removed_count}`
        });
        clearSelection();
        setShowDeleteConfirm(false);
        fetchTransactions();
      } else {
        toast({
          title: 'Не удалось удалить',
          description: data.error || 'Попробуйте ещё раз',
          variant: 'destructive'
        });
      }
    } catch {
      toast({ title: 'Ошибка подключения', description: 'Проверьте интернет-соединение', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Связь считается по группе (union-find по всему списку), а не по
  // одностороннему полю linked_id одной записи - иначе чек, на который
  // ссылается платёж, сам не узнаёт о своей паре и показывает "Нет пары".
  const matchedKeys = useMemo(() => computeMatchedKeys(transactions), [transactions]);

  const groups = useMemo(
    () =>
      groupTransactions(
        filterTransactions(transactions, { matchedKeys, showUnmatchedOnly, dateFilter, searchQuery })
      ),
    [transactions, matchedKeys, showUnmatchedOnly, dateFilter, searchQuery]
  );

  const matchedCountByType = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    transactions.forEach((tx) => {
      if (matchedKeys.has(nodeKey(tx))) {
        counts[tx.type] = (counts[tx.type] || 0) + 1;
      }
    });
    return counts;
  }, [transactions, matchedKeys]);

  const relatedItems = useMemo(() => {
    if (!selectedTx) return [];
    const key = nodeKey(selectedTx);
    return (
      groupTransactions(transactions)
        .find((g) => g.items.some((i) => nodeKey(i) === key))
        ?.items.filter((i) => nodeKey(i) !== key) || []
    );
  }, [transactions, selectedTx]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Загрузка транзакций...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <TransactionsPageHeader
        backfillPhase={backfillPhase}
        isRefreshing={isRefreshing}
        onOpenBackfill={openBackfillDialog}
        onRefresh={fetchTransactions}
      />

      <TransactionsSummaryCards totalsByType={totalsByType} matchedCountByType={matchedCountByType} />

      <TransactionsRegistryCard
        groups={groups}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        showUnmatchedOnly={showUnmatchedOnly}
        setShowUnmatchedOnly={setShowUnmatchedOnly}
        selectedTxByKey={selectedTxByKey}
        isLinking={isLinking}
        onLink={handleLink}
        onDeleteClick={() => setShowDeleteConfirm(true)}
        onClearSelection={clearSelection}
        onRowClick={handleRowClick}
        onToggleSelect={handleToggleSelect}
        onDetach={handleDetach}
        detachingKey={detachingKey}
      />

      <TransactionDetailsDialog
        transaction={selectedTx}
        relatedItems={relatedItems}
        onDetach={handleDetach}
        detachingKey={detachingKey}
        open={showDetails}
        onOpenChange={setShowDetails}
      />

      <DeleteTransactionsDialog
        open={showDeleteConfirm}
        count={selectedTxByKey.size}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirmed}
        isDeleting={isDeleting}
      />

      <BackfillDialog
        ecomkassaIntegrations={ecomkassaIntegrations}
        ofdIntegrations={ofdIntegrations}
        bankIntegrations={bankIntegrations}
      />
    </div>
  );
};

export default TransactionsPage;