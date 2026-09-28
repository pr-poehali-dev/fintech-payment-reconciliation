import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Transaction } from './transactionsTypes';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, DEFAULT_TIMEZONE } from '@/lib/formatDate';

interface TransactionsTableProps {
  transactions: Transaction[];
  onRowClick: (transaction: Transaction) => void;
}

const typeConfig: Record<string, { icon: string; label: string; className: string }> = {
  payment: { icon: 'CreditCard', label: 'Платёж', className: 'bg-primary/10 text-primary border-primary/30' },
  receipt: { icon: 'Receipt', label: 'Чек', className: 'bg-info/10 text-info border-info/30' },
  money: { icon: 'Landmark', label: 'Деньги', className: 'bg-success/10 text-success border-success/30' },
};

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'CONFIRMED':
    case 'Income':
    case 'done':
    case 'in':
      return 'bg-success';
    case 'AUTHORIZED':
      return 'bg-info';
    case 'REJECTED':
    case 'RefundIncome':
    case 'RefundExpense':
    case 'fail':
      return 'bg-destructive';
    case 'REFUNDED':
    case 'Expense':
    case 'out':
      return 'bg-warning';
    case 'CANCELED':
      return 'bg-muted-foreground';
    default:
      return 'bg-muted-foreground';
  }
};

const TransactionsTable = ({ transactions, onRowClick }: TransactionsTableProps) => {
  const { currentCompany } = useAuth();
  const timezone = currentCompany?.timezone || DEFAULT_TIMEZONE;
  const formatAmount = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Тип</TableHead>
            <TableHead>Дата и время</TableHead>
            <TableHead>Описание</TableHead>
            <TableHead>Интеграция</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Транзакции не найдены
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((tx) => {
              const config = typeConfig[tx.type] || typeConfig.payment;
              return (
                <TableRow
                  key={`${tx.type}-${tx.id}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRowClick(tx)}
                >
                  <TableCell>
                    <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
                      <Icon name={config.icon as any} size={12} />
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(tx.occurred_at, timezone)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{tx.title}</div>
                    {tx.subtitle && (
                      <div className="text-xs text-muted-foreground">{tx.subtitle}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {tx.integration_name || '—'}
                  </TableCell>
                  <TableCell>
                    {tx.status && (
                      <Badge className={`${getStatusColor(tx.status)} text-white`}>
                        {tx.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAmount(tx.amount)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default TransactionsTable;
