import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import PaymentDetailsDialog from '@/components/payments/PaymentDetailsDialog';
import functionUrls from '../../backend/func2url.json';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Payment {
  id: number;
  payment_id: string;
  amount: number;
  order_id: string;
  status: string;
  payment_status: string;
  error_code: string;
  customer_email: string;
  customer_phone: string;
  pan: string;
  card_type: string;
  exp_date: string;
  terminal_key: string;
  raw_data: any;
  receipt_id: number | null;
  created_at: string;
  integration_name: string;
  provider_name: string;
}

const PaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [integrationFilter, setIntegrationFilter] = useState<string>('all');
  const { toast } = useToast();

  const ownerId = 1;

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${functionUrls['payments-list']}?owner_id=${ownerId}&limit=100`);
      const data = await response.json();

      if (response.ok) {
        setPayments(data.payments || []);
        setTotal(data.total || 0);
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить платежи',
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
    fetchPayments();
  }, []);

  const handleRowClick = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDetails(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-500';
      case 'AUTHORIZED':
        return 'bg-blue-500';
      case 'REJECTED':
        return 'bg-red-500';
      case 'REFUNDED':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const uniqueIntegrations = Array.from(
    new Set(payments.map(p => p.integration_name))
  );

  const statusOptions = [
    { value: 'all', label: 'Все статусы', count: payments.length },
    { value: 'CONFIRMED', label: 'Подтверждён', count: payments.filter(p => p.status === 'CONFIRMED').length },
    { value: 'AUTHORIZED', label: 'Авторизован', count: payments.filter(p => p.status === 'AUTHORIZED').length },
    { value: 'REJECTED', label: 'Отклонён', count: payments.filter(p => p.status === 'REJECTED').length },
    { value: 'REFUNDED', label: 'Возврат', count: payments.filter(p => p.status === 'REFUNDED').length },
  ];

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchQuery || (() => {
      const query = searchQuery.toLowerCase();
      return (
        payment.payment_id.toLowerCase().includes(query) ||
        payment.order_id?.toLowerCase().includes(query) ||
        payment.customer_email?.toLowerCase().includes(query) ||
        payment.customer_phone?.toLowerCase().includes(query) ||
        payment.amount.toString().includes(query)
      );
    })();

    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesIntegration = integrationFilter === 'all' || payment.integration_name === integrationFilter;

    return matchesSearch && matchesStatus && matchesIntegration;
  });

  const totalAmount = filteredPayments
    .filter(p => p.status === 'CONFIRMED')
    .reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Загрузка платежей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Платежи</h2>
          <p className="text-muted-foreground">Все входящие платежи из интеграций</p>
        </div>
        <Button onClick={fetchPayments} variant="outline">
          <Icon name="RefreshCw" size={16} className="mr-2" />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего платежей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Подтверждено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {payments.filter(p => p.status === 'CONFIRMED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Сумма подтверждённых
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {totalAmount.toLocaleString('ru-RU')} ₽
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Список платежей</CardTitle>
                <CardDescription>Кликните на строку для просмотра деталей</CardDescription>
              </div>
              <div className="w-64">
                <Input
                  placeholder="Поиск по ID, сумме, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Статус</label>
                <div className="flex gap-2 flex-wrap">
                  {statusOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={statusFilter === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(option.value)}
                      className="gap-2"
                    >
                      {option.label}
                      <Badge variant="secondary" className="ml-1">
                        {option.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              {uniqueIntegrations.length > 1 && (
                <div className="w-64">
                  <label className="text-sm font-medium mb-2 block">Интеграция</label>
                  <select
                    value={integrationFilter}
                    onChange={(e) => setIntegrationFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">Все интеграции</option>
                    {uniqueIntegrations.map((integration) => (
                      <option key={integration} value={integration}>
                        {integration}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(statusFilter !== 'all' || integrationFilter !== 'all' || searchQuery) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="Filter" size={16} />
                <span>
                  Показано {filteredPayments.length} из {payments.length} платежей
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setIntegrationFilter('all');
                    setSearchQuery('');
                  }}
                  className="ml-auto"
                >
                  Сбросить фильтры
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="Inbox" size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {payments.length === 0 
                  ? 'Платежи ещё не поступали. Настройте интеграции для получения данных.'
                  : 'По вашему запросу ничего не найдено'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>ID платежа</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Карта</TableHead>
                  <TableHead>Интеграция</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow 
                    key={payment.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(payment)}
                  >
                    <TableCell className="font-mono text-sm">
                      {formatDate(payment.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.payment_id}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {payment.amount.toLocaleString('ru-RU')} ₽
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(payment.status)} text-white`}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.pan || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{payment.integration_name}</div>
                        <div className="text-xs text-muted-foreground">{payment.provider_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaymentDetailsDialog
        open={showDetails}
        onOpenChange={setShowDetails}
        payment={selectedPayment}
      />
    </div>
  );
};

export default PaymentsPage;