import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface PaymentsStatisticsProps {
  groupedPayments: GroupedPayment[];
  payments: Payment[];
  totalAmount: number;
}

const PaymentsStatistics = ({ groupedPayments, payments, totalAmount }: PaymentsStatisticsProps) => {
  return (
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
            Уникальных заказов
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Всего вебхуков
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{payments.length}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Включая все статусы
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Сумма подтверждённых
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {totalAmount.toLocaleString('ru-RU', { 
              style: 'currency', 
              currency: 'RUB',
              minimumFractionDigits: 0
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Только CONFIRMED
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsStatistics;
