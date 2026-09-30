import { useCallback, useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, DEFAULT_TIMEZONE } from '@/lib/formatDate';
import { AutomationJob, JOB_STATUS } from './automationConfig';
import functionUrls from '../../../backend/func2url.json';

interface HistoryItem {
  level: string;
  message: string;
  created_at: string;
}

interface AutomationJournalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'error', label: 'Повтор' },
  { value: 'failed', label: 'Не удалось' },
  { value: 'done', label: 'Выполнены' },
  { value: 'ready', label: 'Собраны' }
];

const AutomationJournal = ({ open, onOpenChange }: AutomationJournalProps) => {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const timezone = currentCompany?.timezone || DEFAULT_TIMEZONE;
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!currentCompany) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ company_id: String(currentCompany.id), limit: '200' });
      if (filter) params.set('status', filter);
      const res = await fetch(`${functionUrls['automation-jobs']}?${params}`);
      const data = await res.json();
      if (res.ok) setJobs(data.jobs || []);
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany, filter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggle = async (job: AutomationJob) => {
    if (expanded === job.id) {
      setExpanded(null);
      return;
    }
    setExpanded(job.id);
    setHistory([]);
    const res = await fetch(`${functionUrls['automation-jobs']}?company_id=${currentCompany?.id}&job_id=${job.id}`);
    const data = await res.json();
    setHistory(data.history || []);
  };

  const retry = async (job: AutomationJob) => {
    setRetrying(job.id);
    try {
      const res = await fetch(functionUrls['automation-jobs'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', company_id: currentCompany?.id, job_id: job.id })
      });
      const data = await res.json();
      if (!res.ok) toast({ title: 'Не удалось повторить', description: data.error, variant: 'destructive' });
      setExpanded(null);
      await load();
    } finally {
      setRetrying(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon name="ScrollText" size={20} />
            Журнал
          </SheetTitle>
          <SheetDescription>Задания сценариев: что пришло, что собрано, где ошибка</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Button size="icon" variant="ghost" className="ml-auto" onClick={load} title="Обновить">
            <Icon name="RefreshCw" size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {jobs.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Заданий пока нет. Они появятся, когда запущенный сценарий получит событие.
            </div>
          )}
          {jobs.map((job) => {
            const st = JOB_STATUS[job.status] || JOB_STATUS.new;
            return (
              <div key={job.id} className="rounded-lg border border-border">
                <button type="button" onClick={() => toggle(job)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{job.scenario_name}</span>
                      <Badge variant="outline" className={`shrink-0 ${st.className}`}>{st.label}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {job.source_type === 'payment' ? 'Платёж' : job.source_type} #{job.source_id} · {formatDateTime(job.created_at, timezone)}
                      {job.attempts > 1 && ` · попыток: ${job.attempts}`}
                    </div>
                    {job.last_error && <div className="mt-1 text-xs text-destructive">{job.last_error}</div>}
                  </div>
                  <Icon name={expanded === job.id ? 'ChevronUp' : 'ChevronDown'} size={16} className="mt-1 text-muted-foreground" />
                </button>
                {expanded === job.id && (
                  <div className="space-y-2 border-t border-border bg-muted/20 p-3">
                    {history.map((h, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="shrink-0 text-muted-foreground">{formatDateTime(h.created_at, timezone, true)}</span>
                        <span className={h.level === 'error' ? 'text-destructive' : ''}>{h.message}</span>
                      </div>
                    ))}
                    {(job.status === 'error' || job.status === 'failed') && (
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={retrying === job.id} onClick={() => retry(job)}>
                        <Icon name={retrying === job.id ? 'Loader2' : 'RotateCw'} size={14} className={retrying === job.id ? 'animate-spin' : ''} />
                        Повторить сейчас
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AutomationJournal;
