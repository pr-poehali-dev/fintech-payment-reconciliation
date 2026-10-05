import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/formatDate';
import PageBanner from '@/components/banners/PageBanner';
import { Banner, BannerPage, BannerVariant, BANNER_VARIANTS, bannersApi } from '@/components/banners/bannerTypes';

const emptyBanner = (page: string): Banner => ({ page, text: '', button_text: '', button_url: '', variant: 'info' });

const AdminBannersSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pages, setPages] = useState<BannerPage[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Banner>>({});
  const [saved, setSaved] = useState<Record<string, Banner>>({});
  const [savingPage, setSavingPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (data: { banners: Banner[]; pages: BannerPage[] }) => {
    const byPage = Object.fromEntries((data.banners || []).map((b) => [b.page, b]));
    const full = Object.fromEntries((data.pages || []).map((p) => [p.id, byPage[p.id] ?? emptyBanner(p.id)]));
    setPages(data.pages || []);
    setSaved(full);
    setDrafts(full);
  };

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`${bannersApi}?requester_user_id=${user.user_id}&section=banners`);
    const data = await res.json();
    if (res.ok) apply(data);
    else setError(data.error || 'Не удалось загрузить баннеры');
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (page: string, patch: Partial<Banner>) =>
    setDrafts((d) => ({ ...d, [page]: { ...d[page], ...patch } }));

  const save = async (page: string, override?: Partial<Banner>) => {
    if (!user) return;
    const banner = { ...drafts[page], ...override };
    setSavingPage(page);
    try {
      const res = await fetch(bannersApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_banner', requester_user_id: user.user_id, ...banner }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось сохранить');
      apply(data);
      toast({ title: banner.text.trim() ? 'Баннер сохранён' : 'Баннер скрыт' });
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось сохранить', variant: 'destructive' });
    } finally {
      setSavingPage(null);
    }
  };

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold mb-2">Баннеры</h2>
        <p className="text-muted-foreground">
          Сообщения для клиентов вверху страниц личного кабинета. Пока поле «Текст» пустое, баннер не показывается.
        </p>
      </div>

      {pages.map((p) => {
        const d = drafts[p.id] ?? emptyBanner(p.id);
        const s = saved[p.id] ?? emptyBanner(p.id);
        const active = !!s.text.trim();
        const dirty = JSON.stringify({ ...d, updated_at: null }) !== JSON.stringify({ ...s, updated_at: null });
        const buttonIncomplete = !!d.button_text.trim() !== !!d.button_url.trim();
        return (
          <Card key={p.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {p.name}
                  <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Показывается' : 'Скрыт'}</Badge>
                </CardTitle>
                {s.updated_at && (
                  <span className="text-xs text-muted-foreground">Изменён {formatDateTime(s.updated_at)}</span>
                )}
              </div>
              {p.id === 'all' && <CardDescription>Показывается над баннером конкретной страницы на всех страницах кабинета</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Текст</label>
                <Textarea
                  value={d.text}
                  onChange={(e) => update(p.id, { text: e.target.value })}
                  placeholder="Пусто - баннер не показывается"
                  rows={2}
                  maxLength={2000}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm text-muted-foreground">Текст кнопки</label>
                  <Input value={d.button_text} onChange={(e) => update(p.id, { button_text: e.target.value })} placeholder="Например: Подробнее" maxLength={80} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Ссылка кнопки</label>
                  <Input value={d.button_url} onChange={(e) => update(p.id, { button_url: e.target.value })} placeholder="https://..." maxLength={500} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Вид</label>
                  <Select value={d.variant} onValueChange={(v) => update(p.id, { variant: v as BannerVariant })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BANNER_VARIANTS) as BannerVariant[]).map((v) => (
                        <SelectItem key={v} value={v}>{BANNER_VARIANTS[v].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {buttonIncomplete && (
                <p className="text-xs text-muted-foreground">Кнопка появится, только когда заполнены и текст, и ссылка.</p>
              )}

              {d.text.trim() && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Так увидит клиент:</p>
                  <PageBanner banner={d} />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => save(p.id)} disabled={!dirty || savingPage === p.id}>
                  {savingPage === p.id ? <Icon name="Loader2" size={16} className="mr-2 animate-spin" /> : <Icon name="Save" size={16} className="mr-2" />}
                  Сохранить
                </Button>
                {active && (
                  <Button variant="outline" onClick={() => save(p.id, { text: '' })} disabled={savingPage === p.id}>
                    <Icon name="EyeOff" size={16} className="mr-2" />
                    Скрыть
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminBannersSection;
