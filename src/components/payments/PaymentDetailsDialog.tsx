import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

interface PaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
}

const PaymentDetailsDialog = ({ open, onOpenChange, payment }: PaymentDetailsDialogProps) => {
  if (!payment) return null;

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
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Icon name="Receipt" size={24} />
            Платёж #{payment.payment_id}
          </DialogTitle>
          <DialogDescription>
            Детальная информация о платеже из {payment.provider_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Сумма</p>
              <p className="text-2xl font-bold text-primary">
                {payment.amount.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge className={`${getStatusColor(payment.status)} text-white`}>
                {payment.status}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="CreditCard" size={18} />
              Информация о платеже
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">ID платежа</p>
                <p className="font-mono text-sm">{payment.payment_id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ID заказа</p>
                <p className="font-mono text-sm">{payment.order_id || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Терминал</p>
                <p className="font-mono text-sm">{payment.terminal_key}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Интеграция</p>
                <p className="text-sm">{payment.integration_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дата создания</p>
                <p className="text-sm">{formatDate(payment.created_at)}</p>
              </div>
              {payment.error_code && (
                <div>
                  <p className="text-sm text-muted-foreground">Код ошибки</p>
                  <p className="text-sm text-red-500">{payment.error_code}</p>
                </div>
              )}
            </div>
          </div>

          {(payment.pan || payment.card_type) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Icon name="CreditCard" size={18} />
                  Карта
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {payment.pan && (
                    <div>
                      <p className="text-sm text-muted-foreground">Номер карты</p>
                      <p className="font-mono text-sm">{payment.pan}</p>
                    </div>
                  )}
                  {payment.card_type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Тип карты</p>
                      <p className="text-sm">{payment.card_type}</p>
                    </div>
                  )}
                  {payment.exp_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Срок действия</p>
                      <p className="font-mono text-sm">{payment.exp_date}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {(payment.customer_email || payment.customer_phone) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Icon name="User" size={18} />
                  Клиент
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {payment.customer_email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm">{payment.customer_email}</p>
                    </div>
                  )}
                  {payment.customer_phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Телефон</p>
                      <p className="text-sm">{payment.customer_phone}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="Code" size={18} />
              Данные вебхука (raw JSON)
            </h3>
            <div className="bg-muted p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(payment.raw_data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDetailsDialog;
