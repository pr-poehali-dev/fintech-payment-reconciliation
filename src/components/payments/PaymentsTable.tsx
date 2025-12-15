import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
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

interface PaymentsTableProps {
  filteredGroupedPayments: GroupedPayment[];
  expandedRows: Set<string>;
  toggleRowExpand: (orderId: string, e: React.MouseEvent) => void;
  getStatusColor: (status: string) => string;
  formatDate: (dateStr: string) => string;
  handleRowClick: (payment: Payment) => void;
}

const PaymentsTable = ({
  filteredGroupedPayments,
  expandedRows,
  toggleRowExpand,
  getStatusColor,
  formatDate,
  handleRowClick
}: PaymentsTableProps) => {
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>ID заказа / платежа</TableHead>
            <TableHead>Сумма</TableHead>
            <TableHead>Статусы</TableHead>
            <TableHead>Карта</TableHead>
            <TableHead>Интеграция</TableHead>
            <TableHead>Дата</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredGroupedPayments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Платежи не найдены
              </TableCell>
            </TableRow>
          ) : (
            filteredGroupedPayments.map((group) => {
              const rowKey = group.order_id || group.payment_id;
              const isExpanded = expandedRows.has(rowKey);
              
              return (
                <React.Fragment key={rowKey}>
                  <TableRow 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => toggleRowExpand(rowKey, e)}
                  >
                    <TableCell>
                      <Icon 
                        name={isExpanded ? "ChevronDown" : "ChevronRight"} 
                        size={16} 
                        className="text-muted-foreground" 
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex flex-col gap-1">
                        {group.order_id && (
                          <div className="text-xs text-muted-foreground">
                            Заказ: {group.order_id}
                          </div>
                        )}
                        <div>ID: {group.payment_id}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {group.amount.toLocaleString('ru-RU', { 
                        style: 'currency', 
                        currency: 'RUB',
                        minimumFractionDigits: 0
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {group.statuses.map((statusItem, idx) => (
                          <Badge 
                            key={`${statusItem.id}-${idx}`}
                            className={`${getStatusColor(statusItem.status)} text-white`}
                          >
                            {statusItem.status}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {group.pan ? (
                        <span className="font-mono text-sm">**** {group.pan}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{group.integration_name}</div>
                      <div className="text-xs text-muted-foreground">{group.provider_name}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(group.first_created_at)}
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
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3 flex-1">
                                    <div className="text-2xl mt-1">
                                      {numberEmojis[idx] || `${idx + 1}️⃣`}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className={`${getStatusColor(payment.status)} text-white`}>
                                          {payment.status}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                          {formatDate(payment.created_at)}
                                        </span>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <div>
                                          <span className="text-muted-foreground">Webhook ID:</span>{' '}
                                          <span className="font-mono">{payment.id}</span>
                                        </div>
                                        {payment.error_code && (
                                          <div>
                                            <span className="text-muted-foreground">Код ошибки:</span>{' '}
                                            <span className="text-red-500 font-semibold">{payment.error_code}</span>
                                          </div>
                                        )}
                                        {payment.customer_email && (
                                          <div>
                                            <span className="text-muted-foreground">Email:</span>{' '}
                                            <span>{payment.customer_email}</span>
                                          </div>
                                        )}
                                        {payment.customer_phone && (
                                          <div>
                                            <span className="text-muted-foreground">Телефон:</span>{' '}
                                            <span>{payment.customer_phone}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <Button 
                                    variant="outline" 
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
                              </div>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default PaymentsTable;