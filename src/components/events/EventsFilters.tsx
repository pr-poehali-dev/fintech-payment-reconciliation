import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface EventsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  integrationFilter: string;
  setIntegrationFilter: (integration: string) => void;
  uniqueIntegrations: string[];
}

const EventsFilters = ({
  searchQuery,
  setSearchQuery,
  integrationFilter,
  setIntegrationFilter,
  uniqueIntegrations
}: EventsFiltersProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Icon
          name="Search"
          size={16}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Поиск по номеру события..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {uniqueIntegrations.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={integrationFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIntegrationFilter('all')}
          >
            Все интеграции
          </Button>
          {uniqueIntegrations.map(integration => (
            <Button
              key={integration}
              variant={integrationFilter === integration ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIntegrationFilter(integration)}
            >
              {integration}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsFilters;