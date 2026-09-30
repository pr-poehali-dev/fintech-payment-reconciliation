import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { TableCell } from '@/components/ui/table';
import { Transaction } from '../transactionsTypes';
import { TransactionGroup } from '@/lib/transactionGrouping';
import { typeConfig, formatAmount } from './tableHelpers';

export const SelectCell = ({ isSelected, onToggle }: { isSelected: boolean; onToggle: () => void }) => (
  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
    <div
      className={`transition-all duration-150 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}
    >
      <Checkbox checked={isSelected} onCheckedChange={onToggle} aria-label="Выбрать транзакцию" />
    </div>
  </TableCell>
);

export const TypeBadge = ({ type }: { type: string }) => {
  const config = typeConfig[type] || typeConfig.payment;
  return (
    <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
      <Icon name={config.icon} size={12} />
      {config.label}
    </Badge>
  );
};

// Дата, описание и интеграция - одинаковы для главной и вложенной строки.
export const InfoCells = ({ tx, dateText }: { tx: Transaction; dateText: string }) => (
  <>
    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{dateText}</TableCell>
    <TableCell>
      <div className="text-sm font-medium">{tx.title}</div>
      {tx.subtitle && <div className="text-xs text-muted-foreground">{tx.subtitle}</div>}
    </TableCell>
    <TableCell className="text-sm">{tx.integration_name || '—'}</TableCell>
  </>
);

// Знак суммы - это чистый вклад транзакции в выручку (возврат вычитается,
// а не увеличивает итог), в отличие от amount - абсолютной величины
// документа как она есть в исходных данных.
export const AmountValue = ({ tx }: { tx: Transaction }) => {
  const signed = tx.signed_amount ?? tx.amount;
  const isNegative = (signed ?? 0) < 0;
  const isZero = signed === 0 && tx.amount !== 0;
  return (
    <div className={isNegative ? 'text-destructive' : isZero ? 'text-muted-foreground' : ''}>
      {formatAmount(signed)}
      {isZero && <div className="text-xs font-normal text-muted-foreground">возврат, эффект 0</div>}
    </div>
  );
};

// Итог по группе - считается на уровне группы (по каждой реальной сделке
// один раз, см. transactionGrouping.ts/computeTotal), а не берётся от
// одной "главной" строки - иначе, например, ручная склейка продажи и
// отдельного возврата в одну группу показала бы сумму только продажи.
export const GroupAmountValue = ({ group }: { group: TransactionGroup }) => {
  const total = group.totalAmount;
  const isNegative = total < 0;
  const isZero = total === 0 && group.items.length > 1;
  return (
    <div className={isNegative ? 'text-destructive' : isZero ? 'text-muted-foreground' : ''}>
      {formatAmount(total)}
      {isZero && <div className="text-xs font-normal text-muted-foreground">взаимно погашено</div>}
    </div>
  );
};
