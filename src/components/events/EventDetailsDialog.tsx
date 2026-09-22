import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { AppEvent } from './eventsTypes';

interface EventDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AppEvent | null;
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
    minute: '2-digit',
    second: '2-digit'
  });
};

const EventDetailsDialog = ({ open, onOpenChange, event }: EventDetailsDialogProps) => {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Icon name="Radio" size={24} />
            {event.summary}
          </DialogTitle>
          <DialogDescription>
            Событие из {event.integration_name} ({event.provider_type})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Номер события</p>
              <p className="text-lg font-semibold font-mono">{event.event_number || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge className={`${getStatusColor(event.status)} text-white`}>
                {event.status || '—'}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="Info" size={18} />
              Информация о событии
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Тип интеграции</p>
                <p className="text-sm">{event.provider_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Интеграция</p>
                <p className="text-sm">{event.integration_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дата и время</p>
                <p className="text-sm">{formatDate(event.created_at)}</p>
              </div>
              {event.event_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Тип события</p>
                  <p className="text-sm font-mono">{event.event_type}</p>
                </div>
              )}
            </div>
          </div>

          {event.error_message && (
            <div className="p-3 bg-destructive/10 rounded-md">
              <div className="flex items-start gap-2">
                <Icon name="AlertCircle" size={16} className="text-destructive mt-0.5" />
                <div>
                  <div className="font-medium text-sm text-destructive mb-1">Ошибка обработки</div>
                  <div className="text-xs text-muted-foreground">{event.error_message}</div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="Code" size={18} />
              Данные события (raw JSON)
            </h3>
            <div className="bg-muted p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(event.raw, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailsDialog;
