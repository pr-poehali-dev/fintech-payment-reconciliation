import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import functionUrls from '../../backend/func2url.json';

interface Receipt {
  source: 'ofd' | 'cash_register';
  id: number;
  integration_id: number;
  integration_name: string;
  document_id: string;
  operation_type: string;
  total_sum: number;
  cash_sum: number;
  ecash_sum: number;
  doc_number: string;
  document_datetime: string;
  fn_number: string;
  created_at: string;
  raw_data: any;
}

const ReceiptsPage = () => {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const ownerId = 1;

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        owner_id: ownerId.toString(),
        limit: '100',
        offset: '0'
      });

      const response = await fetch(`${functionUrls['receipts-list']}?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setReceipts(data.receipts || []);
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить чеки',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Проверьте подключение к интернету',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'ofd':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">ОФД</Badge>;
      case 'cash_register':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Касса</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  const getOperationTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; className: string }> = {
      'Income': { label: 'Приход', className: 'bg-green-100 text-green-800 border-green-200' },
      'Expense': { label: 'Расход', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      'RefundIncome': { label: 'Возврат прихода', className: 'bg-red-100 text-red-800 border-red-200' },
      'RefundExpense': { label: 'Возврат расхода', className: 'bg-purple-100 text-purple-800 border-purple-200' }
    };

    const config = typeMap[type] || { label: type, className: 'bg-gray-100 text-gray-800 border-gray-200' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const filteredReceipts = receipts.filter(receipt => {
    const matchesSearch = searchQuery === '' || 
      receipt.doc_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.integration_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.total_sum?.toString().includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'income' && receipt.operation_type === 'Income') ||
      (statusFilter === 'expense' && receipt.operation_type === 'Expense') ||
      (statusFilter === 'refund' && (receipt.operation_type === 'RefundIncome' || receipt.operation_type === 'RefundExpense'));

    return matchesSearch && matchesStatus;
  });

  const totalReceipts = receipts.length;
  const totalIncome = receipts.filter(r => r.operation_type === 'Income').length;
  const totalSum = receipts.filter(r => r.operation_type === 'Income').reduce((sum, r) => sum + r.total_sum, 0);

  const statusButtons = [
    { id: 'all', label: 'Все статусы', count: totalReceipts },
    { id: 'income', label: 'Приход', count: totalIncome },
    { id: 'expense', label: 'Расход', count: receipts.filter(r => r.operation_type === 'Expense').length },
    { id: 'refund', label: 'Возврат', count: receipts.filter(r => r.operation_type.includes('Refund')).length }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground mb-2">Чеки</h2>
        <p className="text-muted-foreground">Все входящие чеки из интеграций</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего чеков</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-foreground">{totalReceipts}</div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Приход</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-green-600">{totalIncome}</div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сумма прихода</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-purple-600">
              {formatAmount(totalSum)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Список чеков</CardTitle>
              <CardDescription>Кликните на строку для просмотра деталей</CardDescription>
            </div>
            <Button onClick={loadReceipts} variant="outline" size="sm" className="gap-2">
              <Icon name="RefreshCw" className={loading ? 'animate-spin' : ''} size={16} />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Поиск по ID, сумме, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Статус:</span>
              <div className="flex gap-2">
                {statusButtons.map(status => (
                  <Button
                    key={status.id}
                    variant={statusFilter === status.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status.id)}
                    className="gap-2"
                  >
                    {status.label}
                    <Badge variant="secondary" className="ml-1">
                      {status.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin text-muted-foreground" size={32} />
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="Receipt" className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground">
                  {receipts.length === 0 
                    ? 'Чеки ещё не поступали. Настройте интеграции для получения данных.'
                    : 'По вашему запросу ничего не найдено'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Источник</TableHead>
                      <TableHead>Интеграция</TableHead>
                      <TableHead>Дата/Время</TableHead>
                      <TableHead>Тип операции</TableHead>
                      <TableHead>Номер</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead className="text-right">Нал</TableHead>
                      <TableHead className="text-right">Безнал</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.map((receipt) => (
                      <TableRow 
                        key={`${receipt.source}-${receipt.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>{getSourceBadge(receipt.source)}</TableCell>
                        <TableCell className="font-medium">
                          {receipt.integration_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateTime(receipt.document_datetime)}
                        </TableCell>
                        <TableCell>
                          {getOperationTypeBadge(receipt.operation_type)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {receipt.doc_number || '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(receipt.total_sum)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatAmount(receipt.cash_sum)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatAmount(receipt.ecash_sum)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiptsPage;
