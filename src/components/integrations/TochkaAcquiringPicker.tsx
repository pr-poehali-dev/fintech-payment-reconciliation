import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { prepareAuthWindow } from '@/lib/openExternalAuth';
import { ConfigState } from './providerFieldsConfig';
import functionUrls from '../../../backend/func2url.json';

interface Retailer {
  merchant_id: string;
  terminal_id: string | null;
  name: string | null;
  customer_code: string;
  customer_name: string;
}

interface TochkaAcquiringPickerProps {
  companyId: number;
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
  visiblePassword: boolean;
  onTogglePasswordVisibility: () => void;
  onBeforeOAuthRedirect?: () => void;
}

const api = (functionUrls as Record<string, string>)['tochka-oauth'];

const TochkaAcquiringPicker = ({
  companyId,
  config,
  onConfigChange,
  visiblePassword,
  onTogglePasswordVisibility,
  onBeforeOAuthRedirect
}: TochkaAcquiringPickerProps) => {
  // Новое подключение - сразу вход через Точку; старые интеграции с токеном остаются на JWT.
  const authMethod = (config.auth_method as string) || (String(config.api_token ?? '').trim() ? 'jwt' : 'oauth');
  const isOAuth = authMethod === 'oauth';
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const merchantId = String(config.merchant_id ?? '');

  const loadAcquiring = async (current: ConfigState) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${api}?action=acquiring&company_id=${companyId}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Не удалось получить торговые точки');
        if (data.oauth_required) setConnected(false);
        return;
      }
      const list: Retailer[] = data.retailers || [];
      setRetailers(list);
      setWebhookError(data.webhook_ready ? null : data.webhook_error || 'Не удалось подписаться на оплаты');
      const selected = list.find((r) => r.merchant_id === String(current.merchant_id ?? ''));
      const customerCode = selected?.customer_code || list[0]?.customer_code || data.customers?.[0]?.customer_code || '';
      onConfigChange({
        ...current,
        auth_method: 'oauth',
        api_token: '',
        customer_code: customerCode,
        merchant_id: selected ? selected.merchant_id : list.length === 1 ? list[0].merchant_id : String(current.merchant_id ?? '')
      });
    } catch {
      setError('Проблема с подключением к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOAuth) return;
    setConnected(null);
    setError('');
    fetch(`${api}?action=status&company_id=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        setConfigured(data.configured !== false);
        setConnected(!!data.connected);
        if (data.connected) loadAcquiring(config);
      })
      .catch(() => setConnected(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOAuth, companyId]);

  const connect = async () => {
    const authWindow = prepareAuthWindow();
    setIsRedirecting(true);
    setError('');
    try {
      const res = await fetch(`${api}?action=authorize_url&company_id=${companyId}`);
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

  const selectRetailer = (r: Retailer | null) => {
    onConfigChange({
      ...config,
      merchant_id: r ? r.merchant_id : '',
      customer_code: r ? r.customer_code : retailers[0]?.customer_code || String(config.customer_code ?? '')
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Способ подключения</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => onConfigChange({ ...config, auth_method: 'oauth' })}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
              isOAuth ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Icon name="Link" size={16} className={isOAuth ? 'text-primary' : 'text-muted-foreground'} />
            <div>
              <div className="text-sm font-medium">Вход через Точку</div>
              <div className="text-xs text-muted-foreground">Без токена и ручного вебхука</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onConfigChange({ ...config, auth_method: 'jwt', customer_code: '' })}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
              !isOAuth ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Icon name="KeyRound" size={16} className={!isOAuth ? 'text-primary' : 'text-muted-foreground'} />
            <div>
              <div className="text-sm font-medium">JWT-токен</div>
              <div className="text-xs text-muted-foreground">Вставить токен вручную</div>
            </div>
          </button>
        </div>
      </div>

      {isOAuth ? (
        <div className="rounded-lg border border-border p-3 space-y-3">
          {connected === null ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Icon name="Loader2" size={14} className="animate-spin" />
              Проверяем подключение…
            </p>
          ) : !configured ? (
            <p className="text-sm text-muted-foreground">Вход через Точку ещё не настроен на платформе — пока используйте JWT-токен</p>
          ) : (
            <>
              <p className="text-sm flex items-center gap-1.5">
                <Icon
                  name={connected ? 'CircleCheck' : 'Info'}
                  size={15}
                  className={connected ? 'text-success' : 'text-muted-foreground'}
                />
                {connected
                  ? 'Доступ к Точке подтверждён'
                  : 'Войдите в интернет-банк Точки и подтвердите доступ к интернет-эквайрингу'}
              </p>
              <Button
                type="button"
                size="sm"
                variant={connected ? 'outline' : 'default'}
                onClick={connect}
                disabled={isRedirecting}
                className="gap-1.5"
              >
                <Icon name={isRedirecting ? 'Loader2' : 'ExternalLink'} size={14} className={isRedirecting ? 'animate-spin' : ''} />
                {connected ? 'Подключить заново' : 'Подключить через Точку'}
              </Button>
              {!connected && (
                <p className="text-xs text-muted-foreground">
                  После подтверждения форма откроется снова — останется выбрать торговую точку. Вебхук об оплатах настроим сами
                </p>
              )}
              {isLoading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Icon name="Loader2" size={12} className="animate-spin" />
                  Загружаем торговые точки и подписываемся на оплаты…
                </p>
              )}
            </>
          )}

          {connected && !isLoading && retailers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Торговая точка</Label>
              {retailers.length > 1 && (
                <RetailerOption
                  active={!merchantId}
                  title="Все торговые точки"
                  subtitle="Принимаем оплаты по всем точкам компании"
                  onClick={() => selectRetailer(null)}
                />
              )}
              {retailers.map((r) => (
                <RetailerOption
                  key={r.merchant_id}
                  active={merchantId === r.merchant_id}
                  title={r.name || 'Торговая точка'}
                  subtitle={`MID ${r.merchant_id}${r.terminal_id ? ` · TID ${r.terminal_id}` : ''}${
                    new Set(retailers.map((x) => x.customer_code)).size > 1 ? ` · ${r.customer_name}` : ''
                  }`}
                  onClick={() => selectRetailer(r)}
                />
              ))}
            </div>
          )}

          {connected && !isLoading && !error && retailers.length === 0 && config.customer_code && (
            <p className="text-xs text-muted-foreground">
              Торговых точек интернет-эквайринга не найдено — будем принимать все оплаты по платёжным ссылкам компании
            </p>
          )}

          {connected && !isLoading && !error && config.customer_code && (
            <p className={`text-xs flex items-start gap-1.5 ${webhookError ? 'text-warning' : 'text-muted-foreground'}`}>
              <Icon name={webhookError ? 'TriangleAlert' : 'Webhook'} fallback="Bell" size={13} className="mt-0.5 shrink-0" />
              {webhookError
                ? `Оплаты пока не приходят автоматически: ${webhookError}`
                : 'Уведомления об оплатах подключены автоматически — настраивать вебхук в Точке не нужно'}
            </p>
          )}
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="tochka_acq_token">JWT-токен Точки</Label>
            <div className="relative">
              <Input
                id="tochka_acq_token"
                type={visiblePassword ? 'text' : 'password'}
                placeholder="eyJhbGciOi…"
                value={String(config.api_token ?? '')}
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
              Интернет-банк Точки → Интеграции и API → Подключить → токен с разрешением «Интернет-эквайринг». Проверим его у банка при сохранении
            </p>
          </div>
          <div>
            <Label htmlFor="tochka_acq_merchant">Торговая точка (merchantId)</Label>
            <Input
              id="tochka_acq_merchant"
              placeholder="200000000012345"
              value={merchantId}
              onChange={(e) => onConfigChange({ ...config, merchant_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Необязательно. Если точек несколько — укажите нужную, иначе принимаем оплаты всех точек
            </p>
          </div>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

const RetailerOption = ({
  active,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors ${
      active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
    }`}
  >
    <div className="min-w-0">
      <div className="text-sm font-medium truncate">{title}</div>
      <div className="text-xs text-muted-foreground font-mono truncate">{subtitle}</div>
    </div>
    {active && <Icon name="Check" size={16} className="text-primary shrink-0" />}
  </button>
);

export default TochkaAcquiringPicker;
