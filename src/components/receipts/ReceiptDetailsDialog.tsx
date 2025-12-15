import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

interface ReceiptDetailsDialogProps {
  receipt: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ReceiptDetailsDialog = ({ receipt, open, onOpenChange }: ReceiptDetailsDialogProps) => {

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getOperationTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'Income': 'Приход',
      'Expense': 'Расход',
      'RefundIncome': 'Возврат прихода',
      'RefundExpense': 'Возврат расхода'
    };
    return typeMap[type] || type;
  };

  const getOperationTypeBadge = (type: string) => {
    const typeMap: Record<string, string> = {
      'Income': 'bg-green-100 text-green-800 border-green-200',
      'Expense': 'bg-orange-100 text-orange-800 border-orange-200',
      'RefundIncome': 'bg-red-100 text-red-800 border-red-200',
      'RefundExpense': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    const className = typeMap[type] || 'bg-gray-100 text-gray-800 border-gray-200';
    return <Badge variant="outline" className={className}>{getOperationTypeLabel(type)}</Badge>;
  };

  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Детали чека</DialogTitle>
          <DialogDescription>
            Подробная информация о фискальном документе
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Источник</div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {receipt.source === 'ofd' ? 'ОФД' : 'Касса'}
                </Badge>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Тип операции</div>
                {getOperationTypeBadge(receipt.operation_type)}
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Интеграция</div>
                <div className="font-medium">{receipt.integration_name}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">ID документа</div>
                <div className="font-mono text-sm">{receipt.document_id}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Номер документа</div>
                <div className="font-medium">{receipt.doc_number}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">ФН</div>
                <div className="font-mono text-sm">{receipt.fn_number}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Дата документа</div>
                <div className="font-medium">{formatDateTime(receipt.document_datetime)}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Загружен</div>
                <div className="font-medium">{formatDateTime(receipt.created_at)}</div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Общая сумма</div>
                <div className="text-2xl font-bold text-foreground">
                  {formatAmount(receipt.total_sum)}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Наличные</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(receipt.cash_sum)}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Электронные</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatAmount(receipt.ecash_sum)}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-lg font-semibold mb-3">Raw Data</div>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(receipt.raw_data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptDetailsDialog;