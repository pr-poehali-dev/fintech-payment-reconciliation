import { Switch } from '@/components/ui/switch';
import { formatDateTime } from '@/lib/formatDate';

export interface CronSourceIntegration {
  id: number;
  name: string | null;
  company: string;
  last_synced_at: string | null;
}

export interface CronSource {
  key: string;
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
              {src.integrations.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {src.integrations.map((i) => (
                    <li key={i.id} className="flex flex-wrap gap-x-2">
                      <span className="text-foreground">{i.company}</span>
                      <span>· {i.name || 'Без названия'}</span>
                      {i.last_synced_at && <span>· загружено {formatDateTime(i.last_synced_at, undefined, true)}</span>}
                    </li>
                  ))}
                </ul>
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
