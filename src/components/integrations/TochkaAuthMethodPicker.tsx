import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { ConfigState } from './providerFieldsConfig';

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
            value={(config.api_token ?? '') as string}
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
    </div>
  );
};

export default TochkaAuthMethodPicker;
