import { Switch } from '@/components/ui/switch';
import { formatDateTime } from '@/lib/formatDate';

export interface CronSourceIntegration {
  id: number;
  name: string | null;
  company: string;
  last_synced_at: string | null;
}

export interface CronSourceRun {
  loaded: number;
  calls: number;
  failed: number;
  finished_at: string | null;
  error: string | null;
  pending?: number;
}

export interface CronSource {
  key: string;
  unit: string;
  last_run: CronSourceRun | null;
  name: string;
  hint: string;
  enabled: boolean;
  integrations: CronSourceIntegration[];
}

interface Props {
  sources: CronSource[];
  values: Record<string, boolean>;
  onChange: (key: string, enabled: boolean) => void;
}

const lastSync = (src: CronSource) =>
  src.integrations.map((i) => i.last_synced_at).filter(Boolean).sort().pop() || null;

const CronSourcesList = ({ sources, values, onChange }: Props) => (
  <div className="space-y-2">
    <div className="text-sm font-medium">Что загружать автоматически</div>
    <div className="divide-y divide-border rounded-lg border border-border">
      {sources.map((src) => {
        const on = values[src.key] ?? src.enabled;
        return (
          <div key={src.key} className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{src.name}</div>
              <div className="text-xs text-muted-foreground">{src.hint}</div>
              {src.last_run?.finished_at && (
                <div className={`mt-1 text-xs ${src.last_run.failed ? 'text-destructive' : 'text-foreground'}`}>
                  {src.last_run.failed && src.last_run.failed === src.last_run.calls
                    ? `Не загрузилось ${formatDateTime(src.last_run.finished_at, undefined, true)}: ${src.last_run.error || 'ошибка'}`
                    : `Загрузили ${src.last_run.loaded} ${src.unit} ${formatDateTime(src.last_run.finished_at, undefined, true)}`}
                  {src.last_run.failed > 0 && src.last_run.failed < src.last_run.calls && ` · с ошибкой: ${src.last_run.failed} из ${src.last_run.calls}`}
                  {src.last_run.pending ? ' · банк ещё формирует выписку, заберём при следующем запуске' : ''}
                </div>
              )}
              {src.integrations.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Подключено у компаний: {new Set(src.integrations.map((i) => i.company)).size}
                  {lastSync(src) && <> · последняя загрузка {formatDateTime(lastSync(src)!, undefined, true)}</>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`text-xs ${on ? 'text-foreground' : 'text-muted-foreground'}`}>{on ? 'Да' : 'Нет'}</span>
              <Switch checked={on} onCheckedChange={(v) => onChange(src.key, v)} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default CronSourcesList;