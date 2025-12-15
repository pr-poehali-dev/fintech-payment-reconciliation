import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

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

interface PaymentsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  integrationFilter: string;
  setIntegrationFilter: (integration: string) => void;
  groupedPayments: GroupedPayment[];
  uniqueIntegrations: string[];
}

const PaymentsFilters = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  integrationFilter,
  setIntegrationFilter,
  groupedPayments,
  uniqueIntegrations
}: PaymentsFiltersProps) => {
  const statusOptions = [
    { value: 'all', label: 'Все статусы', count: groupedPayments.length },
    { value: 'CONFIRMED', label: 'Подтверждён', count: groupedPayments.filter(p => p.latest_status === 'CONFIRMED').length },
    { value: 'AUTHORIZED', label: 'Авторизован', count: groupedPayments.filter(p => p.latest_status === 'AUTHORIZED').length },
    { value: 'REJECTED', label: 'Отклонён', count: groupedPayments.filter(p => p.latest_status === 'REJECTED').length },
    { value: 'REFUNDED', label: 'Возврат', count: groupedPayments.filter(p => p.latest_status === 'REFUNDED').length },
    { value: 'CANCELED', label: 'Отменён', count: groupedPayments.filter(p => p.latest_status === 'CANCELED').length },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="relative flex-1">
        <Icon 
          name="Search" 
          size={16} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
        />
        <Input
          placeholder="Поиск по ID, email, телефону, сумме..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <div className="flex gap-2 flex-wrap">
        {statusOptions.map(option => (
          <Button
            key={option.value}
            variant={statusFilter === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(option.value)}
          >
            {option.label} {option.count > 0 && `(${option.count})`}
          </Button>
        ))}
      </div>

      {uniqueIntegrations.length > 1 && (
        <div className="flex gap-2">
          <Button
            variant={integrationFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIntegrationFilter('all')}
          >
            Все
          </Button>
          {uniqueIntegrations.map(integration => (
            <Button
              key={integration}
              variant={integrationFilter === integration ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIntegrationFilter(integration)}
            >
              {integration}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentsFilters;
