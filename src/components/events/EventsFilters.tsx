import { Input } from '@/components/ui/input';
import DateRangeFilter, { DateFilter } from '@/components/filters/DateRangeFilter';

interface EventsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateFilter: DateFilter | null;
  setDateFilter: (value: DateFilter | null) => void;
}

const EventsFilters = ({ searchQuery, setSearchQuery, dateFilter, setDateFilter }: EventsFiltersProps) => {
  return (
    <div className="flex items-center gap-3 overflow-x-auto p-0.5">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Input
          placeholder="Номер события, сумма или данные вебхука"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[180px] max-w-md w-auto"
        />
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
      </div>
    </div>
  );
};

export default EventsFilters;
