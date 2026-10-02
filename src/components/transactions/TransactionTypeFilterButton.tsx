import MultiSelectFilterButton, { FilterOption } from '@/components/filters/MultiSelectFilterButton';
import { TransactionType } from '@/components/transactions/transactionsTypes';
import { typeConfig } from '@/components/transactions/table/tableHelpers';

const TYPE_OPTIONS: FilterOption<TransactionType>[] = (
  ['crm_deal', 'payment', 'receipt_kassa', 'receipt_order', 'receipt_ofd', 'money'] as TransactionType[]
).map((type) => ({ value: type, label: typeConfig[type].label, icon: typeConfig[type].icon }));

interface TransactionTypeFilterButtonProps {
  value: TransactionType[];
  onChange: (value: TransactionType[]) => void;
}

const TransactionTypeFilterButton = ({ value, onChange }: TransactionTypeFilterButtonProps) => (
  <MultiSelectFilterButton title="Виды записей" options={TYPE_OPTIONS} value={value} onChange={onChange} />
);

export default TransactionTypeFilterButton;
