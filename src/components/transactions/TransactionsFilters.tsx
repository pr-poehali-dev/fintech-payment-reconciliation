import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TransactionType, TransactionTotalsByType } from './transactionsTypes';

interface TransactionsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  typeFilter: TransactionType | 'all';
  setTypeFilter: (value: TransactionType | 'all') => void;
  totalsByType: TransactionTotalsByType;
  totalCount: number;
  showUnmatchedOnly: boolean;
  setShowUnmatchedOnly: (value: boolean) => void;
}

const typeButtons: { id: TransactionType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'Все', icon: 'LayoutGrid' },
  { id: 'payment', label: 'Платежи', icon: 'CreditCard' },
  { id: 'receipt', label: 'Чеки', icon: 'Receipt' },
  { id: 'money', label: 'Деньги', icon: 'Landmark' },
];

const TransactionsFilters = ({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  totalsByType,
  totalCount,
  showUnmatchedOnly,
  setShowUnmatchedOnly
}: TransactionsFiltersProps) => {
  const countFor = (id: TransactionType | 'all') =>
    id === 'all' ? totalCount : totalsByType[id]?.count ?? 0;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Поиск по номеру, сумме, описанию..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-md"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Тип:</span>
        <div className="flex gap-2 flex-wrap">
          {typeButtons.map((btn) => (
            <Button
              key={btn.id}
              variant={typeFilter === btn.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(btn.id)}
              className="gap-2"
            >
              <Icon name={btn.icon as any} size={14} />
              {btn.label}
              <Badge variant="secondary" className="ml-1">
                {countFor(btn.id)}
              </Badge>
            </Button>
          ))}
        </div>

        <Button
          variant={showUnmatchedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowUnmatchedOnly(!showUnmatchedOnly)}
          className="gap-2 ml-auto"
        >
          <Icon name="Unlink" size={14} />
          Только без пары
        </Button>
      </div>
    </div>
  );
};

export default TransactionsFilters;