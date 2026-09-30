import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TableCell, TableRow } from '@/components/ui/table';
import { Transaction } from '../transactionsTypes';
import { SelectCell, TypeBadge, InfoCells, AmountValue } from './tableCells';
import { getStatusDisplay, rowClassName } from './tableHelpers';

interface TransactionChildRowProps {
  tx: Transaction;
  isSelected: boolean;
  dateText: string;
  onRowClick: (tx: Transaction) => void;
  onToggleSelect: (tx: Transaction) => void;
}

const TransactionChildRow = ({ tx, isSelected, dateText, onRowClick, onToggleSelect }: TransactionChildRowProps) => {
  return (
    <TableRow className={`${rowClassName(isSelected)} bg-muted/20`} onClick={() => onRowClick(tx)}>
      <SelectCell isSelected={isSelected} onToggle={() => onToggleSelect(tx)} />
      <TableCell className="pl-10">
        <Icon name="CornerDownRight" size={13} className="inline mr-1.5 text-muted-foreground" />
        <TypeBadge type={tx.type} />
      </TableCell>
      <InfoCells tx={tx} dateText={dateText} />
      <TableCell>
        {tx.status && (
          <Badge className={`${getStatusDisplay(tx).color} text-white`}>{getStatusDisplay(tx).label}</Badge>
        )}
      </TableCell>
      <TableCell />
      <TableCell className="text-right font-semibold">
        <AmountValue tx={tx} />
      </TableCell>
    </TableRow>
  );
};

export default TransactionChildRow;
