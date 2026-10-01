import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ScenarioDialog, { ScenarioForm } from '@/components/automation/ScenarioDialog';
import AutomationJournal from '@/components/automation/AutomationJournal';
import { ACTIONS, ActionTemplateOption, IntegrationOption, Scenario, TRIGGERS } from '@/components/automation/automationConfig';
import functionUrls from '../../backend/func2url.json';

interface IntegrationRow {
  id: number;
  integration_name: string;
  provider_name: string;
  provider_slug: string;
  category_slug: string;
  status: string;
}

const AutomationPage = () => {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const companyId = currentCompany?.id;
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [templates, setTemplates] = useState<ActionTemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Scenario | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [failedJobs, setFailedJobs] = useState(0);

  const api = functionUrls['automation-scenarios'];

  const load = useCallback(async () => {
    if (!companyId) return;
    const [sRes, iRes, tRes] = await Promise.all([
      fetch(`${api}?company_id=${companyId}`),
      fetch(`${functionUrls['integrations-list']}?company_id=${companyId}`),
      fetch(`${(functionUrls as Record<string, string>)['admin-action-templates']}?active=1`)
    ]);
    const sData = await sRes.json();
    const iData = await iRes.json();
    const tData = await tRes.json();
    setScenarios(sData.scenarios || []);
    setTemplates(tData.templates || []);
    setIntegrations(
      ((iData.user_integrations || []) as IntegrationRow[])
        .filter((i) => i.status === 'active')
        .map((i) => ({ id: i.id, name: i.integration_name, providerName: i.provider_name, providerSlug: i.provider_slug, category: i.category_slug }))
    );
    setIsLoading(false);
  }, [api, companyId]);

  const loadFailedCount = useCallback(async () => {
    if (!companyId) return;
    const res = await fetch(`${functionUrls['automation-jobs']}?company_id=${companyId}&status=failed&limit=1`);
    const data = await res.json().catch(() => ({}));
    setFailedJobs(data.counts?.failed || 0);
  }, [companyId]);

  useEffect(() => {
    if (!journalOpen) loadFailedCount();
  }, [journalOpen, loadFailedCount]);

  useEffect(() => {
    load();
    // Открытие раздела заодно дожимает задания, застрявшие в очереди.
    if (companyId) {
      fetch(functionUrls['automation-jobs'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', company_id: companyId })
      }).catch(() => {});
    }
  }, [load, companyId]);

  const call = async (method: string, body: object) => {
    const res = await fetch(api, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, ...body })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Попробуйте ещё раз');
    return data;
  };

  const handleSave = async (form: ScenarioForm) => {
    setIsSaving(true);
    try {
      if (editing) await call('PUT', { id: editing.id, ...form });
      else await call('POST', form);
      toast({ title: editing ? 'Сценарий сохранён' : 'Сценарий создан', description: editing ? undefined : 'Он остановлен — запустите переключателем' });
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({ title: 'Не удалось сохранить', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (s: Scenario) => {
    setTogglingId(s.id);
    try {
      await call('PUT', { id: s.id, status: s.status === 'active' ? 'stopped' : 'active' });
      await load();
    } catch (e) {
      toast({ title: 'Не удалось изменить', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await call('DELETE', { id: toDelete.id });
      toast({ title: 'Сценарий удалён' });
      await load();
    } catch (e) {
      toast({ title: 'Не удалось удалить', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setToDelete(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Автоматизация</h2>
          <p className="text-muted-foreground">Сценарии: событие в интеграции — документ в кассе</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setJournalOpen(true)}>
            <Icon name="ScrollText" size={16} />
            Журнал
            {failedJobs > 0 && (
              <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground" title="Заданий, которые не удалось выполнить">
                {failedJobs}
              </span>
            )}
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Icon name="Plus" size={16} />
            Новый сценарий
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Icon name="Loader2" className="animate-spin text-muted-foreground" size={28} />
        </div>
      ) : scenarios.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <Icon name="Workflow" size={28} className="text-primary" />
            </div>
            <div className="text-lg font-semibold">Сценариев пока нет</div>
            <p className="max-w-md text-sm text-muted-foreground">
              Например: «Новый платёж в Точке → обычный чек в Екомкассе». Сервис сам подготовит данные и создаст документ.
            </p>
            <Button className="mt-2 gap-2" onClick={openCreate}>
              <Icon name="Plus" size={16} />
              Создать первый сценарий
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => {
            const trigger = TRIGGERS[s.trigger_type];
            const action = ACTIONS[s.action_type];
            const active = s.status === 'active';
            return (
              <Card key={s.id} className={`transition-colors ${active ? 'border-primary/40' : ''}`}>
                <CardContent className="flex items-center gap-4 p-5">
                  <Switch
                    checked={active}
                    disabled={togglingId === s.id}
                    onCheckedChange={() => handleToggle(s)}
                    aria-label={active ? 'Остановить' : 'Запустить'}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{s.name}</span>
                      <Badge variant="outline" className={active ? 'bg-success/15 text-success border-success/30' : 'text-muted-foreground'}>
                        {active ? 'Запущен' : 'Остановлен'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                        <Icon name={trigger.icon} size={14} className="text-primary" />
                        {trigger.label}
                        {s.source_integration_name && <span className="text-muted-foreground">· {s.source_integration_name}</span>}
                      </span>
                      <Icon name="ArrowRight" size={14} className="text-muted-foreground" />
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                        <Icon name={action.icon} size={14} className="text-primary" />
                        {s.action_template_name || s.action_template}
                        {s.target_integration_name && <span className="text-muted-foreground">· {s.target_integration_name}</span>}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Заданий: {s.jobs_total}
                      {s.jobs_errors > 0 && <span className="text-warning"> · с ошибкой: {s.jobs_errors}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" title="Изменить" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                      <Icon name="Pencil" size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Удалить" className="text-destructive hover:text-destructive" onClick={() => setToDelete(s)}>
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ScenarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scenario={editing}
        integrations={integrations}
        templates={templates}
        isSaving={isSaving}
        onSave={handleSave}
      />

      <AutomationJournal open={journalOpen} onOpenChange={setJournalOpen} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сценарий?</AlertDialogTitle>
            <AlertDialogDescription>
              «{toDelete?.name}» перестанет срабатывать. Записи в журнале сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AutomationPage;
