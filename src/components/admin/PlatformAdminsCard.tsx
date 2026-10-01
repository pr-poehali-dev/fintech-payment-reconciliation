import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../../backend/func2url.json';

const api = (functionUrls as Record<string, string>)['platform-settings'];

interface Member {
  user_id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role_name: string;
  is_owner: boolean;
  admin: boolean;
}

// Доступ к админке: сотрудники компании платформы, владелец включает/выключает доступ.
const PlatformAdminsCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`${api}?requester_user_id=${user.user_id}&section=admins`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMembers(data.members || []);
      setCanManage(Boolean(data.can_manage));
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (m: Member, enabled: boolean) => {
    if (!user) return;
    setSavingId(m.user_id);
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_admin', requester_user_id: user.user_id, user_id: m.user_id, enabled })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Попробуйте ещё раз');
      setMembers(data.members || []);
      toast({
        title: enabled ? 'Доступ к админке выдан' : 'Доступ к админке закрыт',
        description: 'Сотрудник увидит изменения после обновления страницы'
      });
    } catch (e) {
      toast({ title: 'Не удалось изменить доступ', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="ShieldCheck" size={20} className="text-primary" />
          Доступ к админке
        </CardTitle>
        <CardDescription>
          Сотрудники компании платформы. Владелец имеет доступ всегда, остальным его выдаёт владелец.
          Админка открывается, только когда в кабинете выбрана эта компания.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Icon name="Loader2" className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            В компании платформы пока нет сотрудников. Пригласите их в разделе «Доступ» этой компании.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{m.full_name || m.phone || `Пользователь #${m.user_id}`}</span>
                    <Badge variant="outline" className="text-xs text-muted-foreground">{m.role_name}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[m.phone, m.email].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {m.is_owner ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Всегда</span>
                ) : (
                  <Switch
                    checked={m.admin}
                    disabled={!canManage || savingId === m.user_id}
                    onCheckedChange={(v) => toggle(m, v)}
                    aria-label="Доступ к админке"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {!isLoading && !canManage && members.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Менять доступ может только владелец.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformAdminsCard;
