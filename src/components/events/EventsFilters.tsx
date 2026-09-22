import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppEvent } from './eventsTypes';

interface EventsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  providerTypeFilter: string;
  setProviderTypeFilter: (type: string) => void;
  integrationFilter: string;
  setIntegrationFilter: (integration: string) => void;
  events: AppEvent[];
  uniqueProviderTypes: string[];
  uniqueIntegrations: string[];
}

const EventsFilters = ({
  searchQuery,
  setSearchQuery,
  providerTypeFilter,
  setProviderTypeFilter,
  integrationFilter,
  setIntegrationFilter,
  events,
  uniqueProviderTypes,
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

      {uniqueProviderTypes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={providerTypeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setProviderTypeFilter('all')}
          >
            Все типы ({events.length})
          </Button>
          {uniqueProviderTypes.map(type => (
            <Button
              key={type}
              variant={providerTypeFilter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProviderTypeFilter(type)}
            >
              {type} ({events.filter(e => e.provider_type === type).length})
            </Button>
          ))}
        </div>
      )}

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
