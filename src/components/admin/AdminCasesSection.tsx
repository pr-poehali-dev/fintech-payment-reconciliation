import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/formatDate';
import { LandingCase, casesApi } from '@/components/cases/caseTypes';

const EMPTY = { task: '', company_name: '', niche: '', solution: '' };
const MAX_LOGO = 2 * 1024 * 1024;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const AdminCasesSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<LandingCase[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`${casesApi}?requester_user_id=${user.user_id}`);
    const data = await res.json();
    if (res.ok) setCases(data.cases || []);
    else setError(data.error || 'Не удалось загрузить кейсы');
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch(casesApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_user_id: user?.user_id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
    setCases(data.cases || []);
  };

  const pickLogo = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_LOGO) {
      toast({ title: 'Логотип больше 2 МБ', variant: 'destructive' });
      return;
    }
    setLogo(await readAsDataUrl(file));
  };

  const resetForm = () => {
    setForm(EMPTY);
    setLogo(null);
    setEditingId(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const startEdit = (item: LandingCase) => {
    setEditingId(item.id);
    setForm({ task: item.task, company_name: item.company_name, niche: item.niche, solution: item.solution });
    setLogo(item.logo_url);
    if (fileRef.current) fileRef.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const newLogo = logo?.startsWith('data:') ? logo : null;
      if (editingId) {
        await post({ action: 'update', id: editingId, ...form, logo: newLogo, remove_logo: !logo });
        toast({ title: 'Кейс обновлён' });
      } else {
        await post({ action: 'create', ...form, logo: newLogo });
        toast({ title: 'Кейс добавлен на главную' });
      }
      resetForm();
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось сохранить', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: LandingCase) => {
    if (!window.confirm(`Удалить кейс «${item.company_name}»?`)) return;
    setDeletingId(item.id);
    try {
      await post({ action: 'delete', id: item.id });
      if (editingId === item.id) resetForm();
      toast({ title: 'Кейс удалён' });
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось удалить', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <p className="text-destructive">{error}</p>;

  const ready = Object.values(form).every((v) => v.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold mb-2">Кейсы</h2>
        <p className="text-muted-foreground">
          Кейсы клиентов на главной странице, блок между «Как это работает» и тарифами. Пока нет ни одного кейса — блок скрыт.
          Новые кейсы показываются первыми.
        </p>
      </div>

      <Card className={editingId ? 'border-primary' : undefined}>
        <CardContent className="p-5 space-y-4">
          <div className="font-medium">{editingId ? `Редактирование: ${cases.find((c) => c.id === editingId)?.company_name || ''}` : 'Новый кейс'}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Название компании</label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} maxLength={200} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Ниша</label>
              <Input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="Например: онлайн-школа" maxLength={200} />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Задача</label>
            <Textarea value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} rows={3} maxLength={5000} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Решение</label>
            <Textarea value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} rows={3} maxLength={5000} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Логотип (необязательно, PNG/JPG/WEBP/SVG до 2 МБ)</label>
            <div className="flex items-center gap-3 mt-1">
              {logo && <img src={logo} alt="" className="w-12 h-12 rounded-lg object-contain border border-border p-1" />}
              <Input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => pickLogo(e.target.files?.[0])}
                className="max-w-sm"
              />
              {logo && (
                <Button variant="ghost" size="sm" onClick={() => { setLogo(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  Убрать
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={!ready || saving}>
              {saving ? <Icon name="Loader2" size={16} className="mr-2 animate-spin" /> : <Icon name={editingId ? 'Save' : 'Plus'} size={16} className="mr-2" />}
              {editingId ? 'Сохранить изменения' : 'Добавить кейс'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                Отменить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {cases.length === 0 && <p className="text-sm text-muted-foreground">Кейсов пока нет.</p>}
        {cases.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-5 flex gap-4">
              {item.logo_url ? (
                <img src={item.logo_url} alt="" className="w-12 h-12 rounded-lg object-contain border border-border p-1 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon name="Building2" size={20} className="text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.company_name}</span>
                  <span className="text-sm text-muted-foreground">· {item.niche}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(item.created_at)}</span>
                </div>
                <p className="text-sm"><span className="text-muted-foreground">Задача: </span>{item.task}</p>
                <p className="text-sm"><span className="text-muted-foreground">Решение: </span>{item.solution}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => startEdit(item)} disabled={saving}>
                <Icon name="Pencil" size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(item)} disabled={deletingId === item.id}>
                <Icon name={deletingId === item.id ? 'Loader2' : 'Trash2'} size={16} className={deletingId === item.id ? 'animate-spin' : 'text-destructive'} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminCasesSection;
