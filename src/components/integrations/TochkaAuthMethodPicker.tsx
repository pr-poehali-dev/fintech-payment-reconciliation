import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { ConfigState } from './providerFieldsConfig';
import functionUrls from '../../../backend/func2url.json';

interface TochkaAccount {
  account_id: string;
  account_number: string;
  currency: string | null;
  balance: number | null;
}

interface TochkaAuthMethodPickerProps {
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
  visiblePassword: boolean;
  onTogglePasswordVisibility: () => void;
}

// Точка Банк поддерживает 2 способа авторизации API (см. документацию
// developers.tochka.com/docs/tochka-api/algoritm-raboty-s-jwt-tokenom):
// - JWT - токен генерируется вручную в интернет-банке Точки (задаёте TTL и
//   права доступа сразу там) и вставляется в наш кабинет как есть. Никакого
//   редиректа и подтверждения через OAuth не требуется - подходит, когда
//   интеграцией пользуется только сам владелец счёта. Работает уже сейчас.
//   По этому же токену запрашивается список счетов (Get Accounts List) -
//   номер счёта выбирается из списка, а не вводится вручную.
// - OAuth 2.0 - авторизация через редирект на страницу Точки с подтверждением
//   доступа, обновляемый access/refresh токен без ручного участия владельца
//   счёта в будущем. Нужен, когда доступ предоставляется третьим лицам
//   (например, нашему сервису от имени клиента). Появится позже, аналогично
//   уже реализованному OAuth Т-Банка (T-Business ID).
const TochkaAuthMethodPicker = ({
  config,
  onConfigChange,
  visiblePassword,
  onTogglePasswordVisibility
}: TochkaAuthMethodPickerProps) => {
  const authMethod = (config.auth_method as string) || 'jwt';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<TochkaAccount[]>([]);

  const apiToken = String(config.api_token ?? '');
  const accountNumber = config.account_number ? String(config.account_number) : '';

  const handleFetchAccounts = async () => {
    if (!apiToken.trim()) {
      setError('Вставьте JWT-токен');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(functionUrls['tochka-accounts-list'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_token: apiToken })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setAccounts(data.accounts || []);
      } else {
        setError(data.error || 'Не удалось получить список счетов');
      }
    } catch {
      setError('Проблема с подключением к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Способ авторизации</Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => onConfigChange({ ...config, auth_method: 'jwt' })}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
              authMethod === 'jwt'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Icon name="KeyRound" size={16} className={authMethod === 'jwt' ? 'text-primary' : 'text-muted-foreground'} />
            <div>
              <div className="text-sm font-medium">JWT-токен</div>
              <div className="text-xs text-muted-foreground">Доступно сейчас</div>
            </div>
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 p-3 rounded-lg border border-border opacity-50 cursor-not-allowed text-left"
          >
            <Icon name="Link" size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">OAuth 2.0</div>
              <div className="text-xs text-muted-foreground">Скоро</div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="tochka_api_token">JWT-токен</Label>
        <div className="relative">
          <Input
            id="tochka_api_token"
            type={visiblePassword ? 'text' : 'password'}
            placeholder="eyJhbGciOiJSUzI1NiIs..."
            value={apiToken}
            onChange={(e) => onConfigChange({ ...config, api_token: e.target.value })}
            className="pr-10"
          />
          <button
            type="button"
            onClick={onTogglePasswordVisibility}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <Icon name={visiblePassword ? 'EyeOff' : 'Eye'} size={16} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Сгенерируйте в интернет-банке Точки: Настройки → API → Токены — задайте срок действия и права доступа «Счета» (чтение выписки)
        </p>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={handleFetchAccounts} disabled={isLoading}>
        {isLoading ? (
          <Icon name="Loader2" size={14} className="animate-spin mr-2" />
        ) : (
          <Icon name="Search" size={14} className="mr-2" />
        )}
        {accounts.length > 0 ? 'Обновить список счетов' : 'Найти счета по токену'}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {(accounts.length > 0 || accountNumber) && (
        <div>
          <Label>Расчётный счёт</Label>
          <Select
            value={accountNumber}
            onValueChange={(value) => onConfigChange({ ...config, account_number: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите счёт из списка" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.account_id} value={acc.account_number}>
                  {acc.account_number}
                  {acc.balance !== null ? ` · ${acc.balance.toLocaleString('ru-RU')} ${acc.currency || '₽'}` : ''}
                </SelectItem>
              ))}
              {accountNumber && !accounts.some((a) => a.account_number === accountNumber) && (
                <SelectItem value={accountNumber}>{accountNumber}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default TochkaAuthMethodPicker;
