import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface EventsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const EventsFilters = ({ searchQuery, setSearchQuery }: EventsFiltersProps) => {
  return (
    <div className="relative">
      <Icon
        name="Search"
        size={16}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
      />
      <Input
        placeholder="Поиск по номеру события, сумме или любым данным вебхука..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9"
      />
    </div>
  );
};

export default EventsFilters;