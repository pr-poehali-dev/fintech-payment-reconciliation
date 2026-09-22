import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { ConfigState } from './providerFieldsConfig';
import functionUrls from '../../../backend/func2url.json';

interface EcomkassaStore {
  id: string | number;
  name?: string;
  address?: string;
  [key: string]: unknown;
}

interface EcomkassaStorePickerProps {
  companyId: number;
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
}

const EcomkassaStorePicker = ({ companyId, config, onConfigChange }: EcomkassaStorePickerProps) => {
  const [login, setLogin] = useState(String(config.login ?? ''));
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [stores, setStores] = useState<EcomkassaStore[]>([]);
  const [innMismatch, setInnMismatch] = useState<{ companyInn: string; ecomkassaInn: string } | null>(null);

  const hasToken = !!config.token;
  const storeId = config.store_id ? String(config.store_id) : '';
  const protocolVersion = String(config.protocol_version ?? 'v4');

  const handleFetchStores = async () => {
    if (!login.trim() || !password) {
      setError('Введите логин и пароль');
      return;
    }

    setIsLoading(true);
    setError('');
    setInnMismatch(null);

    try {
      const response = await fetch(functionUrls['ecomkassa-stores-list'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, protocol_version: protocolVersion, company_id: companyId })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setStores(data.stores || []);
        onConfigChange({
          ...config,
          login,
          token: data.token,
          store_id: config.store_id || ''
        });

        if (data.inn_match === false) {
          setInnMismatch({ companyInn: data.company_inn, ecomkassaInn: data.ecomkassa_inn });
        }

        if (!data.stores || data.stores.length === 0) {
          setError('Авторизация прошла успешно, но магазинов не найдено — проверьте личный кабинет Екомкассы');
        }
      } else {
        setError(data.error || 'Не удалось авторизоваться в Екомкассе');
      }
    } catch {
      setError('Проблема с подключением к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ecomkassa_login">Логин</Label>
          <Input
            id="ecomkassa_login"
            placeholder="sales@ecomkassa.ru"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ecomkassa_password">Пароль</Label>
          <Input
            id="ecomkassa_password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={handleFetchStores} disabled={isLoading}>
        {isLoading ? (
          <Icon name="Loader2" size={14} className="animate-spin mr-2" />
        ) : (
          <Icon name="LogIn" size={14} className="mr-2" />
        )}
        {hasToken ? 'Обновить список магазинов' : 'Выбрать магазин'}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {hasToken && !innMismatch && (
        <div className="flex items-center gap-2 text-xs text-success">
          <Icon name="ShieldCheck" size={14} />
          Токен получен
        </div>
      )}

      {innMismatch && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
          <Icon name="AlertTriangle" size={14} className="mt-0.5 shrink-0" />
          <div>
            ИНН организации в Екомкассе ({innMismatch.ecomkassaInn}) не совпадает с ИНН компании
            в кабинете ({innMismatch.companyInn}). Проверьте, что подключаете именно свою Екомкассу —
            иначе чеки будут загружаться от чужого юрлица.
          </div>
        </div>
      )}

      {(hasToken && (stores.length > 0 || storeId)) && (
        <div>
          <Label>Магазин</Label>
          <Select
            value={storeId}
            onValueChange={(value) => onConfigChange({ ...config, store_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите магазин из списка" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={String(store.id)} value={String(store.id)}>
                  {`ID ${store.id}: ${store.name || 'Без названия'}`}
                </SelectItem>
              ))}
              {storeId && !stores.some((s) => String(s.id) === storeId) && (
                <SelectItem value={storeId}>{storeId}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default EcomkassaStorePicker;
