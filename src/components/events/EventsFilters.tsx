import { Input } from '@/components/ui/input';
import DateRangeFilter, { DateFilter } from '@/components/filters/DateRangeFilter';
import MultiSelectFilterButton from '@/components/filters/MultiSelectFilterButton';
import { EVENT_SOURCE_OPTIONS, EventSource } from '@/components/events/eventsTypes';

interface EventsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateFilter: DateFilter | null;
  setDateFilter: (value: DateFilter | null) => void;
  sourceFilter: EventSource[];
  setSourceFilter: (value: EventSource[]) => void;
}

const EventsFilters = ({
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  sourceFilter,
  setSourceFilter
}: EventsFiltersProps) => {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pl-0.5 pr-2 pt-2 pb-0.5">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Input
          placeholder="Номер события, сумма или данные вебхука"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[180px] max-w-md w-auto"
        />
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
        <MultiSelectFilterButton
          title="Источники"
          options={EVENT_SOURCE_OPTIONS}
          value={sourceFilter}
          onChange={setSourceFilter}
        />
      </div>
    </div>
  );
};

export default EventsFilters;
