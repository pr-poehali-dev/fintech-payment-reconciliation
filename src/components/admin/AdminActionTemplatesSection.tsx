import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../../backend/func2url.json';
import ActionTemplateDialog from './ActionTemplateDialog';
import {
  ACTION_TYPE_OPTIONS,
  ActionTemplateForm,
  ActionTemplateRow,
  EMPTY_TEMPLATE,
  operationLabel
} from './actionTemplatesConfig';

const API = (functionUrls as Record<string, string>)['admin-action-templates'];

const AdminActionTemplatesSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ActionTemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ActionTemplateRow | null>(null);
  const [form, setForm] = useState<ActionTemplateForm>(EMPTY_TEMPLATE);

  const load = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API}?requester_user_id=${user.user_id}`);
      const data = await res.json();
      if (data.success) setTemplates(data.templates || []);
      else toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
    setDialogOpen(true);
  };

  const openEdit = (t: ActionTemplateRow) => {
    setEditing(t);
    setForm({
      code: t.code,
      action_type: t.action_type,
      name: t.name,
      description: t.description || '',
      operation: t.operation,
      paid: t.paid,
      is_active: t.is_active,
      sort_order: t.sort_order
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const res = await fetch(API, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editing?.id, requester_user_id: user.user_id })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: editing ? 'Шаблон сохранён' : 'Шаблон создан', description: form.name });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon name="Loader2" className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-3xl font-display font-bold text-foreground">Шаблоны действий</h2>
          <p className="text-muted-foreground">Что автоматизация может сделать в кассе — доступно всем компаниям платформы</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Icon name="Plus" size={16} />
          Создать шаблон
        </Button>
      </div>

      {ACTION_TYPE_OPTIONS.map((type) => {
        const list = templates.filter((t) => t.action_type === type.value);
        return (
          <div key={type.value} className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon name={type.icon} size={16} className="text-primary" />
              {type.label}
              <span className="font-normal normal-case">· {list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Шаблонов пока нет</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((t) => (
                  <Card
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className={`cursor-pointer transition-colors hover:border-primary/40 ${t.is_active ? '' : 'opacity-60'}`}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{t.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{t.code}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={t.is_active ? 'border-success/30 bg-success/15 text-success' : 'text-muted-foreground'}
                        >
                          {t.is_active ? 'Доступен' : 'Выключен'}
                        </Badge>
                      </div>
                      {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-muted px-2 py-1">{operationLabel(t.operation)}</span>
                        <span className="rounded-md bg-muted px-2 py-1">{t.paid ? 'С оплатой' : 'Без оплаты'}</span>
                        <span className="rounded-md bg-muted px-2 py-1">Сценариев: {t.scenarios_count}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <ActionTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        isEditing={!!editing}
        scenariosCount={editing?.scenarios_count || 0}
      />
    </div>
  );
};

export default AdminActionTemplatesSection;
