import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import DateRangeFilter, { DateFilter } from '@/components/filters/DateRangeFilter';

export type { DateFilter };

interface TransactionsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showUnmatchedOnly: boolean;
  setShowUnmatchedOnly: (value: boolean) => void;
  dateFilter: DateFilter | null;
  setDateFilter: (value: DateFilter | null) => void;
  typeFilterSlot?: React.ReactNode;
  onResetDate?: () => void;
}

const TransactionsFilters = ({
  searchQuery,
  setSearchQuery,
  showUnmatchedOnly,
  setShowUnmatchedOnly,
  dateFilter,
  setDateFilter,
  typeFilterSlot,
  onResetDate
}: TransactionsFiltersProps) => {
  return (
    // Одна строка без переносов: поиск тянется (но не шире max-w-md), календарь
    // и "Только без связи" - фиксированной ширины (shrink-0). Input из shadcn
    // по умолчанию w-full - поэтому ширину задаём явно, иначе он выталкивает
    // остальные элементы на новую строку.
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
      <Input
        placeholder="Сумма (2500 или 2 500,00), номер или описание"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-md"
      />

      {typeFilterSlot}

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} onReset={onResetDate} />

      <Button
        variant={showUnmatchedOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => setShowUnmatchedOnly(!showUnmatchedOnly)}
        className="gap-1.5 shrink-0 h-9 px-2.5 sm:gap-2 sm:px-3"
      >
        <Icon name="Unlink" size={14} />
        <span className="sm:hidden">Без связи</span>
        <span className="hidden sm:inline">Только без связи</span>
      </Button>
    </div>
  );
};

export default TransactionsFilters;
