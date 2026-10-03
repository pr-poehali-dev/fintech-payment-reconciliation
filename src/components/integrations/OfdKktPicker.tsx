import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const selected = String(config.kkt ?? '');

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
      if (data.kkts?.length === 1 && !selected) {
        onConfigChange({ ...config, auth_token: authToken.trim(), kkt: data.kkts[0].kkt });
      }
    } catch {
      setError('Сбой сети, попробуйте ещё раз');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Правка интеграции: токен уже есть - сразу показываем список, чтобы можно было сменить кассу.
    if (token && selected && kkts === null) loadKkts(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = kkts || [];
  const selectedMissing = selected && kkts !== null && !options.some((k) => k.kkt === selected);

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
          <Label>Касса</Label>
          {options.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              В OFD.RU нет касс для ИНН {inn}. Проверьте, что токен выдан для этой организации.
            </p>
          ) : (
            <Select value={selected} onValueChange={(v) => onConfigChange({ ...config, kkt: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={`Выберите кассу (${options.length})`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((k) => (
                  <SelectItem key={k.kkt} value={k.kkt}>
                    <div className="flex flex-col">
                      <span>{kktLabel(k)}</span>
                      <span className="text-xs text-muted-foreground">РНМ {k.kkt}{k.serial ? ` · ЗН ${k.serial}` : ''}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedMissing && (
            <p className="mt-1 text-xs text-amber-500">Сохранённая касса (РНМ {selected}) не найдена в OFD.RU — выберите из списка.</p>
          )}
          {inn && options.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Кассы организации с ИНН {inn}</p>}
        </div>
      )}

      {kkts === null && selected && !isLoading && (
        <p className="text-xs text-muted-foreground">Выбрана касса РНМ {selected}</p>
      )}
    </div>
  );
};

export default OfdKktPicker;
