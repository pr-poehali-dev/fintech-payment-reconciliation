import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { prepareAuthWindow } from '@/lib/openExternalAuth';
import { ConfigState } from './providerFieldsConfig';
import functionUrls from '../../../backend/func2url.json';

interface TochkaAccount {
  account_id: string;
  account_number: string;
  currency: string | null;
  balance: number | null;
}

interface TochkaRetailer {
  terminal_id: string;
  merchant_id: string | null;
  name: string | null;
}

interface TochkaAuthMethodPickerProps {
  companyId: number;
  onBeforeOAuthRedirect?: () => void;
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
  companyId,
  onBeforeOAuthRedirect,
  config,
  onConfigChange,
  visiblePassword,
  onTogglePasswordVisibility
}: TochkaAuthMethodPickerProps) => {
  const authMethod = (config.auth_method as string) || 'jwt';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<TochkaAccount[]>([]);
  const [retailers, setRetailers] = useState<TochkaRetailer[]>([]);

  const apiToken = String(config.api_token ?? '');
  const accountNumber = config.account_number ? String(config.account_number) : '';
  const purposeKeywords = String(config.purpose_keywords ?? '');
  const isFirstRenderRef = useRef(true);
  const isOAuth = authMethod === 'oauth';
  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);
  const [oauthConfigured, setOauthConfigured] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const fetchAccounts = async (token: string, silent = false) => {
    if (!isOAuth && !token.trim()) {
      if (!silent) setError('Вставьте JWT-токен');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(functionUrls['tochka-accounts-list'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isOAuth ? { auth_method: 'oauth', company_id: companyId } : { api_token: token })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setAccounts(data.accounts || []);
        setRetailers(data.retailers || []);
      } else if (!silent) {
        setError(data.error || 'Не удалось получить список счетов');
      }
    } catch {
      if (!silent) setError('Проблема с подключением к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  // Список ключевых слов хранится строкой через запятую - добавляем TID,
  // только если его там ещё нет (сравнение по подстроке, т.к. слова могут
  // быть введены пользователем в разном порядке/регистре).
  const addTerminalToKeywords = (terminalId: string) => {
    const existing = purposeKeywords.split(',').map((w) => w.trim()).filter(Boolean);
    if (existing.some((w) => w.toLowerCase() === terminalId.toLowerCase())) return;
    const next = [...existing, terminalId].join(', ');
    onConfigChange({ ...config, purpose_keywords: next });
  };

  // Счета и терминалы подгружаются автоматически, без отдельной кнопки:
  // - при открытии формы редактирования существующей интеграции (токен в
  //   config уже есть при монтировании) - сразу, без задержки, silent (если
  //   токен вдруг истёк, не пугаем ошибкой сразу при открытии формы);
  // - при вводе/вставке токена (в т.ч. в новой интеграции, где поле изначально
  //   пустое) - с debounce 600мс, чтобы не слать запрос на каждый символ.
  useEffect(() => {
    if (!isOAuth) return;
    setAccounts([]);
    setRetailers([]);
    setError('');
    setOauthConnected(null);
    fetch(`${functionUrls['tochka-oauth']}?action=status&company_id=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        setOauthConfigured(data.configured !== false);
        setOauthConnected(!!data.connected);
        if (data.connected) fetchAccounts('', false);
      })
      .catch(() => setOauthConnected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOAuth, companyId]);

  const connectOAuth = async () => {
    const authWindow = prepareAuthWindow();
    setIsRedirecting(true);
    setError('');
    try {
      const res = await fetch(`${functionUrls['tochka-oauth']}?action=authorize_url&company_id=${companyId}`);
      const data = await res.json();
      if (data.success && data.authorize_url) {
        onBeforeOAuthRedirect?.();
        if (authWindow.go(data.authorize_url)) return;
        setError('Браузер заблокировал окно Точки — разрешите всплывающие окна для сайта или откройте кабинет в отдельной вкладке');
        setIsRedirecting(false);
        return;
      }
      authWindow.close();
      setError(data.error || 'Не удалось получить ссылку Точки');
    } catch {
      authWindow.close();
      setError('Проблема с подключением к серверу');
    }
    setIsRedirecting(false);
  };

  useEffect(() => {
    if (isOAuth) return;
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      if (apiToken.trim()) fetchAccounts(apiToken, true);
      return;
    }
    if (!apiToken.trim()) return;
    const timer = setTimeout(() => fetchAccounts(apiToken, true), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  return (
    <div className="space-y-3">
      <div>
        <Label>Способ авторизации</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
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
            onClick={() => onConfigChange({ ...config, auth_method: 'oauth', api_token: '' })}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
              isOAuth
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Icon name="Link" size={16} className={isOAuth ? 'text-primary' : 'text-muted-foreground'} />
            <div>
              <div className="text-sm font-medium">Вход через Точку</div>
              <div className="text-xs text-muted-foreground">Без ручного токена</div>
            </div>
          </button>
        </div>
      </div>

      {isOAuth && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          {oauthConnected === null ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Icon name="Loader2" size={14} className="animate-spin" />
              Проверяем подключение…
            </p>
          ) : !oauthConfigured ? (
            <p className="text-sm text-muted-foreground">Вход через Точку ещё не настроен на платформе — пока используйте JWT-токен</p>
          ) : (
            <>
              <p className="text-sm flex items-center gap-1.5">
                <Icon
                  name={oauthConnected ? 'CircleCheck' : 'Info'}
                  size={15}
                  className={oauthConnected ? 'text-success' : 'text-muted-foreground'}
                />
                {oauthConnected
                  ? 'Доступ к Точке подтверждён'
                  : 'Войдите в интернет-банк Точки и подтвердите доступ к счетам и выписке'}
              </p>
              <Button
                type="button"
                variant={oauthConnected ? 'outline' : 'default'}
                size="sm"
                onClick={connectOAuth}
                disabled={isRedirecting}
                className="gap-1.5"
              >
                <Icon name={isRedirecting ? 'Loader2' : 'ExternalLink'} size={14} className={isRedirecting ? 'animate-spin' : ''} />
                {oauthConnected ? 'Подключить заново' : 'Подключить через Точку'}
              </Button>
              {!oauthConnected && (
                <p className="text-xs text-muted-foreground">
                  После подтверждения форма откроется снова — останется выбрать счёт
                </p>
              )}
              {isLoading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Icon name="Loader2" size={12} className="animate-spin" />
                  Загружаем счета…
                </p>
              )}
            </>
          )}
        </div>
      )}

      {!isOAuth && (
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
          Сгенерируйте в интернет-банке Точки: Настройки → API → Токены — задайте срок действия и права доступа «Счета» (чтение выписки), а также «Эквайринг» — чтобы мы могли сразу подсказать TID ваших терминалов
        </p>
        {isLoading && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <Icon name="Loader2" size={12} className="animate-spin" />
            Ищем счета и терминалы по токену…
          </p>
        )}
      </div>
      )}

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

      {retailers.length > 0 && (
        <div>
          <Label>Терминалы интернет-эквайринга</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Найдены по вашему токену — банк подписывает ими назначение платежа
            (например «...по терминалу TID {retailers[0].terminal_id}...»).
            Добавьте нужный TID в ключевые слова ниже, чтобы такие операции
            точно попадали в выгрузку
          </p>
          <div className="space-y-1.5">
            {retailers.map((r) => {
              const alreadyAdded = purposeKeywords
                .split(',')
                .map((w) => w.trim().toLowerCase())
                .includes(r.terminal_id.toLowerCase());
              return (
                <div
                  key={r.terminal_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.name || 'Торговая точка'}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      TID {r.terminal_id}
                      {r.merchant_id ? ` · MID ${r.merchant_id}` : ''}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={alreadyAdded ? 'ghost' : 'outline'}
                    size="sm"
                    disabled={alreadyAdded}
                    onClick={() => addTerminalToKeywords(r.terminal_id)}
                    className="shrink-0 gap-1.5"
                  >
                    <Icon name={alreadyAdded ? 'Check' : 'Plus'} size={13} />
                    {alreadyAdded ? 'Добавлено' : 'В ключевые слова'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TochkaAuthMethodPicker;