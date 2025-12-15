import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import PaymentDetailsDialog from '@/components/payments/PaymentDetailsDialog';
import PaymentsStatistics from '@/components/payments/PaymentsStatistics';
import PaymentsFilters from '@/components/payments/PaymentsFilters';
import PaymentsTable from '@/components/payments/PaymentsTable';
import functionUrls from '../../backend/func2url.json';

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

      <PaymentsStatistics
        groupedPayments={groupedPayments}
        payments={payments}
        totalAmount={totalAmount}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список платежей</CardTitle>
          <CardDescription>
            Нажмите на строку чтобы раскрыть историю вебхуков
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentsFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            integrationFilter={integrationFilter}
            setIntegrationFilter={setIntegrationFilter}
            groupedPayments={groupedPayments}
            uniqueIntegrations={uniqueIntegrations}
          />

          <PaymentsTable
            filteredGroupedPayments={filteredGroupedPayments}
            expandedRows={expandedRows}
            toggleRowExpand={toggleRowExpand}
            getStatusColor={getStatusColor}
            formatDate={formatDate}
            handleRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {selectedPayment && (
        <PaymentDetailsDialog
          payment={selectedPayment}
          open={showDetails}
          onOpenChange={setShowDetails}
        />
      )}
    </div>
  );
};

export default PaymentsPage;
