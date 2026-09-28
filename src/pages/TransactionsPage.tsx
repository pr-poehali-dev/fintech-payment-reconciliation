import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import TransactionsTable from '@/components/transactions/TransactionsTable';
import TransactionsFilters from '@/components/transactions/TransactionsFilters';
import TransactionDetailsDialog from '@/components/transactions/TransactionDetailsDialog';
import { Transaction, TransactionType, TransactionTotalsByType } from '@/components/transactions/transactionsTypes';
import functionUrls from '../../backend/func2url.json';

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalsByType, setTotalsByType] = useState<TransactionTotalsByType>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const fetchTransactions = async () => {
    if (!companyId) return;
    setIsLoading(true);
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
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleRowClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setShowDetails(true);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (showUnmatchedOnly && tx.linked_id) return false;

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const haystack = [
      tx.title,
      tx.subtitle,
      tx.integration_name,
      tx.reference,
      tx.status,
      tx.amount?.toString()
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Транзакции</h2>
          <p className="text-muted-foreground">
            Готовые данные для сверки: платежи, чеки и деньги на счету
          </p>
        </div>
        <Button onClick={fetchTransactions} variant="outline">
          <Icon name="RefreshCw" size={16} className="mr-2" />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="CreditCard" size={14} />
              Платежи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-foreground">
              {totalsByType.payment?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(totalsByType.payment?.amount ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Icon name="Link2" size={11} />
              Связано {totalsByType.payment?.matched_count ?? 0} из {totalsByType.payment?.count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="Receipt" size={14} />
              Чеки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-foreground">
              {totalsByType.receipt?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(totalsByType.receipt?.amount ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Icon name="Link2" size={11} />
              Связано {totalsByType.receipt?.matched_count ?? 0} из {totalsByType.receipt?.count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="Landmark" size={14} />
              Деньги
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-foreground">
              {totalsByType.money?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(totalsByType.money?.amount ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Реестр транзакций</CardTitle>
          <CardDescription>
            Каждая строка — уже готовая для сверки запись: платёж, чек или банковская операция
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TransactionsFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            totalsByType={totalsByType}
            totalCount={transactions.length}
            showUnmatchedOnly={showUnmatchedOnly}
            setShowUnmatchedOnly={setShowUnmatchedOnly}
          />

          <TransactionsTable transactions={filteredTransactions} onRowClick={handleRowClick} />
        </CardContent>
      </Card>

      <TransactionDetailsDialog
        transaction={selectedTx}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </div>
  );
};

export default TransactionsPage;