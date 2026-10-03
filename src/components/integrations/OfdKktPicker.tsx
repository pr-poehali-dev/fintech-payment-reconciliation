import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { ConfigState } from './providerFieldsConfig';
import functionUrls from '../../../backend/func2url.json';

interface OfdKkt {
  kkt: string;
  serial?: string;
  model?: string;
  address?: string;
  place?: string;
  last_doc?: string;
}

interface OfdKktPickerProps {
  companyId: number;
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
  visiblePassword: boolean;
  onTogglePasswordVisibility: () => void;
}

const kktLabel = (k: OfdKkt) =>
  [k.model, k.place || k.address].filter(Boolean).join(' · ') || `Касса ${k.kkt}`;

const OfdKktPicker = ({ companyId, config, onConfigChange, visiblePassword, onTogglePasswordVisibility }: OfdKktPickerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [kkts, setKkts] = useState<OfdKkt[] | null>(null);
  const [inn, setInn] = useState('');

  const token = String(config.auth_token ?? '');
  // Несколько касс - в kkts; старые настройки с одной кассой - в kkt.
  const selected: string[] = Array.isArray(config.kkts)
    ? (config.kkts as string[])
    : config.kkt
      ? [String(config.kkt)]
      : [];
  const setSelected = (list: string[]) => {
    const next: ConfigState = { ...config, kkts: list };
    delete next.kkt;
    onConfigChange(next);
  };
  const toggle = (kkt: string, on: boolean) =>
    setSelected(on ? [...selected.filter((k) => k !== kkt), kkt] : selected.filter((k) => k !== kkt));

  const loadKkts = async (authToken: string) => {
    if (!authToken.trim()) {
      setError('Введите токен API');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(functionUrls['ofd-fetch-receipts'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_kkts', company_id: companyId, auth_token: authToken.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setKkts(null);
        setError(data.error || 'Не удалось загрузить кассы');
        return;
      }
      setInn(data.inn || '');
      setKkts(data.kkts || []);
      if (data.kkts?.length === 1 && selected.length === 0) {
        const next: ConfigState = { ...config, auth_token: authToken.trim(), kkts: [data.kkts[0].kkt] };
        delete next.kkt;
        onConfigChange(next);
      }
    } catch {
      setError('Сбой сети, попробуйте ещё раз');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Правка интеграции: токен уже есть - сразу показываем список, чтобы можно было сменить кассу.
    if (token && selected.length > 0 && kkts === null) loadKkts(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = kkts || [];
  const missing = kkts !== null ? selected.filter((s) => !options.some((k) => k.kkt === s)) : [];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="ofd_token">Токен API</Label>
        <div className="mt-1 flex gap-2">
          <div className="relative flex-1">
            <Input
              id="ofd_token"
              type={visiblePassword ? 'text' : 'password'}
              value={token}
              placeholder="•••••••••"
              onChange={(e) => {
                onConfigChange({ ...config, auth_token: e.target.value });
                setKkts(null);
              }}
              className="pr-10"
            />
            <button
              type="button"
              onClick={onTogglePasswordVisibility}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name={visiblePassword ? 'EyeOff' : 'Eye'} size={16} />
            </button>
          </div>
          <Button type="button" variant="outline" onClick={() => loadKkts(token)} disabled={isLoading || !token.trim()}>
            {isLoading ? <Icon name="Loader2" size={16} className="mr-2 animate-spin" /> : <Icon name="RefreshCw" size={16} className="mr-2" />}
            Загрузить кассы
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          OFD.RU → Настройки → Управление передачей данных → Ключи доступа API OFD
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <Icon name="AlertTriangle" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {kkts !== null && (
        <div>
          <div className="flex items-center justify-between">
            <Label>Кассы для загрузки чеков</Label>
            {options.length > 1 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setSelected(selected.length === options.length ? [] : options.map((k) => k.kkt))}
              >
                {selected.length === options.length ? 'Снять все' : 'Выбрать все'}
              </button>
            )}
          </div>
          {options.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              В OFD.RU нет касс для ИНН {inn}. Проверьте, что токен выдан для этой организации.
            </p>
          ) : (
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {options.map((k) => {
                const checked = selected.includes(k.kkt);
                return (
                  <label
                    key={k.kkt}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(k.kkt, !!v)} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{kktLabel(k)}</div>
                      <div className="text-xs text-muted-foreground">РНМ {k.kkt}{k.serial ? ` · ЗН ${k.serial}` : ''}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {missing.length > 0 && (
            <p className="mt-1 text-xs text-amber-500">
              Сохранённые кассы не найдены в OFD.RU: РНМ {missing.join(', ')}. Снимите их или проверьте токен.
            </p>
          )}
          {options.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Выбрано: {selected.length} из {options.length}</p>
          )}
        </div>
      )}

      {kkts === null && selected.length > 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">Выбрано касс: {selected.length} (РНМ {selected.join(', ')})</p>
      )}
    </div>
  );
};

export default OfdKktPicker;
