import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import EventsTable from '@/components/events/EventsTable';
import EventsFilters from '@/components/events/EventsFilters';
import EventDetailsDialog from '@/components/events/EventDetailsDialog';
import { AppEvent } from '@/components/events/eventsTypes';
import functionUrls from '../../backend/func2url.json';

const EventsPage = () => {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState('all');
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const fetchEvents = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${functionUrls['events-list']}?company_id=${companyId}&limit=200`);
      const data = await response.json();

      if (response.ok) {
        setEvents(data.events || []);
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить события',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        description: 'Проверьте интернет-соединение',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleRowClick = (event: AppEvent) => {
    setSelectedEvent(event);
    setShowDetails(true);
  };

  const uniqueIntegrations = Array.from(new Set(events.map(e => e.integration_name)));

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || (() => {
      const query = searchQuery.toLowerCase();
      return (
        event.event_number?.toLowerCase().includes(query) ||
        event.summary.toLowerCase().includes(query)
      );
    })();

    const matchesIntegration = integrationFilter === 'all' || event.integration_name === integrationFilter;

    return matchesSearch && matchesIntegration;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Загрузка событий...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">События</h2>
          <p className="text-muted-foreground">
            Все входящие вебхуки и операции по интеграциям компании
          </p>
        </div>
        <Button onClick={fetchEvents} variant="outline">
          <Icon name="RefreshCw" size={16} className="mr-2" />
          Обновить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Лента событий</CardTitle>
          <CardDescription>
            Нажмите на событие, чтобы посмотреть его детали
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EventsFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            integrationFilter={integrationFilter}
            setIntegrationFilter={setIntegrationFilter}
            uniqueIntegrations={uniqueIntegrations}
          />

          <EventsTable events={filteredEvents} onRowClick={handleRowClick} />
        </CardContent>
      </Card>

      <EventDetailsDialog
        open={showDetails}
        onOpenChange={setShowDetails}
        event={selectedEvent}
      />
    </div>
  );
};

export default EventsPage;