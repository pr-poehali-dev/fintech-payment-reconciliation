import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import functionUrls from '../../../backend/func2url.json';

interface AdminCompany {
  id: number;
  name: string;
  inn: string | null;
  status: string;
  created_at: string | null;
  is_platform_admin: boolean;
  owner_name: string | null;
  owner_phone: string | null;
  tariff_name: string | null;
  tariff_id: number | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  users_count: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Активна', className: 'bg-success/10 text-success border-success/20' },
  blocked: { label: 'Заблокирована', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  trial: { label: 'Триал', className: 'bg-info/10 text-info border-info/20' },
  cancelled: { label: 'Отменена', className: 'bg-muted text-muted-foreground border-border' }
};

const AdminCompaniesSection = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tariffs, setTariffs] = useState<{ id: number; name: string }[]>([]);
  const [changingId, setChangingId] = useState<number | null>(null);
  const { toast } = useToast();
  const tariffsApi = (functionUrls as Record<string, string>)['admin-tariffs'];

  useEffect(() => {
    if (!user) return;
    fetch(`${tariffsApi}?requester_user_id=${user.user_id}`)
      .then((res) => res.json())
      .then((data) => setTariffs(data.tariffs || []))
      .catch(() => {});

    fetch(`${functionUrls['admin-companies-list']}?requester_user_id=${user.user_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCompanies(data.companies || []);
        } else {
          setError(data.error || 'Не удалось загрузить компании');
        }
      })
      .catch(() => setError('Проблема с подключением к серверу'))
      .finally(() => setIsLoading(false));
  }, [user]);

  const changeTariff = async (company: AdminCompany, tariffId: number) => {
    setChangingId(company.id);
    try {
      const res = await fetch(tariffsApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_company_tariff', requester_user_id: user?.user_id, company_id: company.id, tariff_id: tariffId })
      });
      const data = await res.json();
      if (res.ok) {
        setCompanies((prev) => prev.map((c) => (c.id === company.id
          ? { ...c, tariff_id: tariffId, tariff_name: data.tariff_name, subscription_status: data.subscription_status }
          : c)));
        toast({ title: `«${company.name}» переведена на тариф «${data.tariff_name}»` });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } finally {
      setChangingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icon name="Loader2" className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground mb-2">Компании</h2>
        <p className="text-muted-foreground">Все компании, зарегистрированные на платформе</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <Icon name="AlertCircle" size={18} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Всего компаний</p>
            <p className="text-2xl font-display font-bold text-foreground">{companies.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">На триале</p>
            <p className="text-2xl font-display font-bold text-info">
              {companies.filter(c => c.subscription_status === 'trial').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">С оплаченной подпиской</p>
            <p className="text-2xl font-display font-bold text-success">
              {companies.filter(c => c.subscription_status === 'active').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-4 font-medium">Компания</th>
                  <th className="p-4 font-medium">Владелец</th>
                  <th className="p-4 font-medium">Тариф</th>
                  <th className="p-4 font-medium">Статус</th>
                  <th className="p-4 font-medium">Пользователей</th>
                  <th className="p-4 font-medium">Регистрация</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const statusInfo = STATUS_CONFIG[company.subscription_status || ''] || STATUS_CONFIG.cancelled;
                  return (
                    <tr key={company.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{company.name}</span>
                          {company.is_platform_admin && (
                            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                              Платформа
                            </Badge>
                          )}
                        </div>
                        {company.inn && <p className="text-xs text-muted-foreground">ИНН {company.inn}</p>}
                      </td>
                      <td className="p-4">
                        <p className="text-foreground">{company.owner_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{company.owner_phone}</p>
                      </td>
                      <td className="p-4">
                        <Select
                          value={company.tariff_id ? String(company.tariff_id) : undefined}
                          onValueChange={(v) => changeTariff(company, Number(v))}
                          disabled={changingId === company.id || tariffs.length === 0}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue placeholder={company.tariff_name || 'Без тарифа'} />
                          </SelectTrigger>
                          <SelectContent>
                            {tariffs.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={statusInfo.className}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-foreground">{company.users_count}</td>
                      <td className="p-4 text-muted-foreground">
                        {company.created_at ? new Date(company.created_at).toLocaleDateString('ru-RU') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {companies.length === 0 && !error && (
            <div className="p-12 text-center text-muted-foreground">
              Компаний пока нет
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCompaniesSection;
