import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const ownerId = 1;

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        owner_id: ownerId.toString(),
        limit: '100',
        offset: '0'
      });

      if (sourceFilter !== 'all') {
        params.append('source', sourceFilter);
      }

      const response = await fetch(`${functionUrls['receipts-list']}?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setReceipts(data.receipts || []);
        setTotal(data.total || 0);
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
  }, [sourceFilter]);

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
      currency: 'RUB'
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
    const typeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'Income': { label: 'Приход', variant: 'default' },
      'Expense': { label: 'Расход', variant: 'secondary' },
      'RefundIncome': { label: 'Возврат прихода', variant: 'destructive' },
      'RefundExpense': { label: 'Возврат расхода', variant: 'outline' }
    };

    const config = typeMap[type] || { label: type, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Чеки</CardTitle>
                <CardDescription>
                  Все чеки из ОФД и касс ({total} шт.)
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Источник:</span>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Все источники" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все источники</SelectItem>
                      <SelectItem value="ofd">ОФД</SelectItem>
                      <SelectItem value="cash_register">Касса</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadReceipts} variant="outline" size="icon">
                  <Icon name="RefreshCw" className={loading ? 'animate-spin' : ''} size={16} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin text-muted-foreground" size={32} />
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-12">
                <Icon name="Receipt" className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground">Чеков пока нет</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Настройте интеграцию с ОФД или кассой
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
                      <TableHead>ФН</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt) => (
                      <TableRow key={`${receipt.source}-${receipt.id}`}>
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
                        <TableCell className="font-mono text-xs">
                          {receipt.fn_number || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReceiptsPage;
