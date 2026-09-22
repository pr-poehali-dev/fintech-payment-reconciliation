import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import TbankAccountPicker from './TbankAccountPicker';
import EcomkassaStorePicker from './EcomkassaStorePicker';
import {
  ConfigState,
  FieldConfig,
  PROVIDER_FIELDS,
  Provider,
  TBANK_NOTIFY_OPTIONS,
  acceptsIncomingWebhook
} from './providerFieldsConfig';

interface IntegrationConfigStepProps {
  selectedProvider: Provider;
  isEditing: boolean;
  companyId: number;
  integrationName: string;
  onIntegrationNameChange: (value: string) => void;
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
  webhookSettings: Record<string, boolean>;
  onWebhookSettingsChange: (settings: Record<string, boolean>) => void;
  forwardUrl: string;
  onForwardUrlChange: (value: string) => void;
  visiblePasswords: Record<string, boolean>;
  onTogglePasswordVisibility: (key: string) => void;
  isLoading: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const IntegrationConfigStep = ({
  selectedProvider,
  isEditing,
  companyId,
  integrationName,
  onIntegrationNameChange,
  config,
  onConfigChange,
  webhookSettings,
  onWebhookSettingsChange,
  forwardUrl,
  onForwardUrlChange,
  visiblePasswords,
  onTogglePasswordVisibility,
  isLoading,
  onBack,
  onCancel,
  onSubmit
}: IntegrationConfigStepProps) => {
  const currentFields = PROVIDER_FIELDS[selectedProvider.slug] || [];
  const isTbankAccount = selectedProvider.slug === 'tbank_account';
  const isEcomkassa = selectedProvider.slug === 'ecomkassa';

  const isConfigValid = () => {
    if (isTbankAccount && !String(config.account_number ?? '').trim()) {
      return false;
    }

    if (isEcomkassa && (!config.token || !String(config.store_id ?? '').trim())) {
      return false;
    }

    return currentFields
      .filter(field => field.required !== false)
      .every(field => {
        const value = config[field.key];
        if (field.type === 'multiselect') {
          return Array.isArray(value) && value.length > 0;
        }
        return value !== undefined && value !== null && String(value).trim() !== '';
      });
  };

  const renderField = (field: FieldConfig) => {
    if (field.type === 'checkbox') {
      return (
        <label key={field.key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!config[field.key]}
            onChange={(e) => onConfigChange({ ...config, [field.key]: e.target.checked })}
          />
          <span className="text-sm">{field.label}</span>
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.key}>
          <Label>{field.label}</Label>
          <Select
            value={String(config[field.key] ?? field.default ?? '')}
            onValueChange={(value) => onConfigChange({ ...config, [field.key]: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.hint && <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>}
        </div>
      );
    }

    if (field.type === 'multiselect') {
      const selected = Array.isArray(config[field.key]) ? (config[field.key] as string[]) : [];
      const toggle = (value: string) => {
        const next = selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value];
        onConfigChange({ ...config, [field.key]: next });
      };

      return (
        <div key={field.key} className="space-y-2">
          <Label>{field.label}</Label>
          <div className="space-y-2">
            {(field.options || []).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
          {field.hint && <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>}
        </div>
      );
    }

    const isPassword = field.type === 'password';
    const isVisible = visiblePasswords[field.key];

    return (
      <div key={field.key}>
        <Label htmlFor={field.key}>{field.label}</Label>
        <div className="relative">
          <Input
            id={field.key}
            type={isPassword && !isVisible ? 'password' : field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder}
            value={(config[field.key] ?? '') as string | number}
            onChange={(e) => onConfigChange({
              ...config,
              [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value
            })}
            className={isPassword ? 'pr-10' : undefined}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => onTogglePasswordVisibility(field.key)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <Icon name={isVisible ? 'EyeOff' : 'Eye'} size={16} />
            </button>
          )}
        </div>
        {field.hint && <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="integration_name">Название (для удобства)</Label>
        <Input
          id="integration_name"
          placeholder="Например: Терминал на кассе №1"
          value={integrationName}
          onChange={(e) => onIntegrationNameChange(e.target.value)}
        />
      </div>

      {isTbankAccount && (
        <TbankAccountPicker
          companyId={companyId}
          accountNumber={String(config.account_number ?? '')}
          onAccountNumberChange={(value) => onConfigChange({ ...config, account_number: value })}
        />
      )}

      {isEcomkassa && (
        <EcomkassaStorePicker
          config={config}
          onConfigChange={onConfigChange}
        />
      )}

      {currentFields.map(renderField)}

      {selectedProvider.slug === 'tbank' && (
        <div className="space-y-2">
          <Label>Уведомления о статусах платежей</Label>
          <div className="space-y-2">
            {TBANK_NOTIFY_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!webhookSettings[key]}
                  onChange={(e) => onWebhookSettingsChange({ ...webhookSettings, [key]: e.target.checked })}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {acceptsIncomingWebhook(selectedProvider.slug) && (
        <div>
          <Label htmlFor="forward_url">URL для переадресации (опционально)</Label>
          <Input
            id="forward_url"
            placeholder="https://your-domain.com/webhook"
            value={forwardUrl}
            onChange={(e) => onForwardUrlChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Данные будут дублироваться на указанный адрес после сохранения в БД
          </p>
        </div>
      )}

      <div className="flex justify-between gap-2">
        {!isEditing && (
          <Button variant="ghost" onClick={onBack}>
            <Icon name="ArrowLeft" size={14} className="mr-2" />
            Назад
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || !isConfigValid()}
          >
            {isLoading ? (
              isEditing ? 'Сохранение...' : 'Создание...'
            ) : (
              isEditing ? 'Сохранить' : 'Далее'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationConfigStep;