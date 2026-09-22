import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppEvent } from './eventsTypes';

interface EventsTableProps {
  events: AppEvent[];
  onRowClick: (event: AppEvent) => void;
}

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'CONFIRMED':
    case 'processed':
      return 'bg-success';
    case 'AUTHORIZED':
      return 'bg-info';
    case 'REJECTED':
    case 'failed':
    case 'rejected':
      return 'bg-destructive';
    case 'REFUNDED':
      return 'bg-warning';
    case 'CANCELED':
      return 'bg-muted-foreground';
    default:
      return 'bg-muted-foreground';
  }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const EventsTable = ({ events, onRowClick }: EventsTableProps) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата и время</TableHead>
            <TableHead>Интеграция</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Номер события</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                События не найдены
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => (
              <TableRow
                key={event.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(event)}
              >
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDate(event.created_at)}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{event.integration_name}</div>
                  <div className="text-xs text-muted-foreground">{event.summary}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{event.provider_type}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {event.event_number || '—'}
                </TableCell>
                <TableCell>
                  {event.status && (
                    <Badge className={`${getStatusColor(event.status)} text-white`}>
                      {event.status}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default EventsTable;
