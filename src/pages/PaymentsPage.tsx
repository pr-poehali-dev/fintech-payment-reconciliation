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

interface GroupedPayment {
  order_id: string;
  payment_id: string;
  amount: number;
  statuses: Array<{
    status: string;
    created_at: string;
    id: number;
  }>;
  latest_status: string;
  first_created_at: string;
  pan: string;
  customer_email: string;
  customer_phone: string;
  integration_name: string;
  provider_name: string;
  payments: Payment[];
}

const PaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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

  const toggleRowExpand = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
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
      case 'CANCELED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
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

  const groupPaymentsByOrder = (payments: Payment[]): GroupedPayment[] => {
    const grouped = new Map<string, GroupedPayment>();

    payments.forEach(payment => {
      const key = payment.order_id || payment.payment_id;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          order_id: payment.order_id,
          payment_id: payment.payment_id,
          amount: payment.amount,
          statuses: [],
          latest_status: payment.status,
          first_created_at: payment.created_at,
          pan: payment.pan,
          customer_email: payment.customer_email,
          customer_phone: payment.customer_phone,
          integration_name: payment.integration_name,
          provider_name: payment.provider_name,
          payments: []
        });
      }

      const group = grouped.get(key)!;
      group.statuses.push({
        status: payment.status,
        created_at: payment.created_at,
        id: payment.id
      });
      group.payments.push(payment);
      
      if (new Date(payment.created_at) > new Date(group.first_created_at)) {
        group.latest_status = payment.status;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(b.first_created_at).getTime() - new Date(a.first_created_at).getTime()
    );
  };

  const groupedPayments = groupPaymentsByOrder(payments);

  const statusOptions = [
    { value: 'all', label: 'Все статусы', count: groupedPayments.length },
    { value: 'CONFIRMED', label: 'Подтверждён', count: groupedPayments.filter(p => p.latest_status === 'CONFIRMED').length },
    { value: 'AUTHORIZED', label: 'Авторизован', count: groupedPayments.filter(p => p.latest_status === 'AUTHORIZED').length },
    { value: 'REJECTED', label: 'Отклонён', count: groupedPayments.filter(p => p.latest_status === 'REJECTED').length },
    { value: 'REFUNDED', label: 'Возврат', count: groupedPayments.filter(p => p.latest_status === 'REFUNDED').length },
    { value: 'CANCELED', label: 'Отменён', count: groupedPayments.filter(p => p.latest_status === 'CANCELED').length },
  ];

  const filteredGroupedPayments = groupedPayments.filter(group => {
    const matchesSearch = !searchQuery || (() => {
      const query = searchQuery.toLowerCase();
      return (
        group.payment_id.toLowerCase().includes(query) ||
        group.order_id?.toLowerCase().includes(query) ||
        group.customer_email?.toLowerCase().includes(query) ||
        group.customer_phone?.toLowerCase().includes(query) ||
        group.amount.toString().includes(query)
      );
    })();

    const matchesStatus = statusFilter === 'all' || group.latest_status === statusFilter;
    const matchesIntegration = integrationFilter === 'all' || group.integration_name === integrationFilter;

    return matchesSearch && matchesStatus && matchesIntegration;
  });

  const totalAmount = groupedPayments
    .filter(p => p.latest_status === 'CONFIRMED')
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
              Всего заказов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{groupedPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {total} вебхуков получено
            </p>
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
              {groupedPayments.filter(p => p.latest_status === 'CONFIRMED').length}
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
                  Показано {filteredGroupedPayments.length} из {groupedPayments.length} заказов
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
          {filteredGroupedPayments.length === 0 ? (
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
                  <TableHead>ID заказа / платежа</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Статусы</TableHead>
                  <TableHead>Карта</TableHead>
                  <TableHead>Интеграция</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroupedPayments.map((group) => {
                  const rowKey = group.order_id || group.payment_id;
                  const isExpanded = expandedRows.has(rowKey);
                  
                  return (
                    <>
                      <TableRow 
                        key={rowKey} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={(e) => toggleRowExpand(rowKey, e)}
                      >
                        <TableCell className="font-mono text-sm">
                          {formatDate(group.first_created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">
                            <div>{group.order_id}</div>
                            <div className="text-xs text-muted-foreground">{group.payment_id}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {group.amount.toLocaleString('ru-RU')} ₽
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {group.statuses
                              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                              .map((s) => (
                                <Badge 
                                  key={s.id} 
                                  className={`${getStatusColor(s.status)} text-white text-xs`}
                                  title={formatDate(s.created_at)}
                                >
                                  {s.status}
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {group.pan || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{group.integration_name}</div>
                            <div className="text-xs text-muted-foreground">{group.provider_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Icon 
                            name={isExpanded ? "ChevronDown" : "ChevronRight"} 
                            size={16} 
                            className="text-muted-foreground" 
                          />
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow key={`${rowKey}-details`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="p-4 space-y-3">
                              <div className="text-sm font-semibold text-muted-foreground mb-3">
                                История вебхуков ({group.payments.length})
                              </div>
                              {group.payments
                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                .map((payment, idx) => (
                                  <div 
                                    key={payment.id}
                                    className="bg-background rounded-lg p-4 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRowClick(payment);
                                    }}
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-semibold">
                                          {idx + 1}
                                        </div>
                                        <div>
                                          <Badge className={`${getStatusColor(payment.status)} text-white mb-1`}>
                                            {payment.status}
                                          </Badge>
                                          <div className="text-xs text-muted-foreground font-mono">
                                            {formatDate(payment.created_at)}
                                          </div>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRowClick(payment);
                                        }}
                                      >
                                        <Icon name="Eye" size={14} className="mr-1" />
                                        Детали
                                      </Button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">Webhook ID</div>
                                        <div className="font-mono text-xs">#{payment.id}</div>
                                      </div>
                                      {payment.error_code && payment.error_code !== '0' && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Код ошибки</div>
                                          <div className="font-mono text-xs text-red-600">{payment.error_code}</div>
                                        </div>
                                      )}
                                      {payment.customer_email && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Email</div>
                                          <div className="text-xs truncate">{payment.customer_email}</div>
                                        </div>
                                      )}
                                      {payment.customer_phone && (
                                        <div>
                                          <div className="text-xs text-muted-foreground mb-1">Телефон</div>
                                          <div className="font-mono text-xs">{payment.customer_phone}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
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