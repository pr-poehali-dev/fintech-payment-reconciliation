import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppEvent, EventWebhookHistoryItem } from './eventsTypes';

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpand = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleHistoryItemClick = (event: AppEvent, historyItem: EventWebhookHistoryItem) => {
    onRowClick({
      ...event,
      status: historyItem.status,
      error_message: historyItem.error_message,
      created_at: historyItem.created_at,
      raw: historyItem.raw,
      event_type: historyItem.event_type
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
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
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                События не найдены
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => {
              const history = event.webhook_history || [];
              const hasHistory = history.length > 1;
              const isExpanded = expandedRows.has(event.id);

              return (
                <React.Fragment key={event.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={(e) => hasHistory ? toggleRowExpand(event.id, e) : onRowClick(event)}
                  >
                    <TableCell>
                      {hasHistory && (
                        <Icon
                          name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                          size={16}
                          className="text-muted-foreground"
                        />
                      )}
                    </TableCell>
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

                  {hasHistory && isExpanded && (
                    <TableRow key={`${event.id}-details`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-0">
                        <div className="p-4 space-y-3">
                          <div className="text-sm font-semibold text-muted-foreground mb-3">
                            История вебхуков ({history.length})
                          </div>
                          {history
                            .slice()
                            .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
                            .map((item, idx) => (
                              <div
                                key={item.id}
                                className="bg-background rounded-lg p-4 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleHistoryItemClick(event, item);
                                }}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3 flex-1">
                                    <Badge variant="outline" className="mt-0.5 shrink-0">{idx + 1}</Badge>
                                    <div className="flex-1 space-y-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {item.status && (
                                          <Badge className={`${getStatusColor(item.status)} text-white`}>
                                            {item.status}
                                          </Badge>
                                        )}
                                        <span className="text-sm text-muted-foreground">
                                          {formatDate(item.created_at)}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <div>
                                          <span className="text-muted-foreground">Webhook ID:</span>{' '}
                                          <span className="font-mono">{item.id}</span>
                                        </div>
                                        {item.error_message && (
                                          <div className="col-span-2">
                                            <span className="text-muted-foreground">Ошибка:</span>{' '}
                                            <span className="text-destructive">{item.error_message}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHistoryItemClick(event, item);
                                    }}
                                  >
                                    <Icon name="Eye" size={14} className="mr-1" />
                                    Детали
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default EventsTable;
