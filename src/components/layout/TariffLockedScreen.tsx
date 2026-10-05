import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { APP_MODULES } from '@/config/modules';
import functionUrls from '../../../backend/func2url.json';

interface TariffInfo {
  slug: string;
  name: string;
  price: number;
  modules?: string[] | null;
}

const formatPrice = (n: number) => new Intl.NumberFormat('ru-RU').format(n);

const TariffLockedScreen = ({ moduleId }: { moduleId: string }) => {
  const { currentCompany } = useAuth();
  const navigate = useNavigate();
  const [tariffs, setTariffs] = useState<TariffInfo[]>([]);
  const module = APP_MODULES.find((m) => m.id === moduleId);

  useEffect(() => {
    fetch(functionUrls['tariffs-list'])
      .then((r) => r.json())
      .then((d) => setTariffs(d.tariffs || []))
      .catch(() => undefined);
  }, []);

  const suitable = tariffs.filter(
    (t) => t.slug !== currentCompany?.tariff_slug && (!t.modules || t.modules.includes(moduleId))
  );

  return (
    <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-border bg-card p-10 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
        <Icon name="Lock" size={28} className="text-primary" />
      </div>
      <h2 className="text-2xl font-display font-bold">
        Раздел «{module?.name ?? moduleId}» недоступен на вашем тарифе
      </h2>
      <p className="mt-3 text-muted-foreground">
        Сейчас у компании тариф «{currentCompany?.tariff_name || '—'}». Перейдите на тариф выше, чтобы открыть этот
        раздел.
      </p>

      {suitable.length > 0 && (
        <div className="mt-6 space-y-2 text-left">
          <div className="text-sm text-muted-foreground">Раздел входит в тарифы:</div>
          {suitable.map((t) => (
            <div
              key={t.slug}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-sm text-muted-foreground">{formatPrice(t.price)} ₽ / мес.</span>
            </div>
          ))}
        </div>
      )}

      <Button className="mt-6" size="lg" onClick={() => navigate('/#pricing')}>
        <Icon name="ArrowUpCircle" size={18} className="mr-2" />
        Сменить тариф
      </Button>
    </div>
  );
};

export default TariffLockedScreen;
