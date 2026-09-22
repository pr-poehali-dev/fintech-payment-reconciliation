import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import functionUrls from '../../../backend/func2url.json';

interface Provider {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  description: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  providers: Provider[];
}

type ConfigValue = string | number | boolean;
type ConfigState = Record<string, ConfigValue>;

interface UserIntegration {
  id: number;
  integration_name: string;
  provider_id: number;
  config: ConfigState;
  webhook_settings: Record<string, boolean>;
  forward_url?: string;
}

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  initialCategory: Category | null;
  editingIntegration: UserIntegration | null;
  allProviders: Provider[];
  connectedProviderIds: number[];
  companyId: number;
  onSuccess: () => void;
}

type FieldType = 'text' | 'password' | 'number' | 'checkbox';

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  default?: ConfigValue;
  required?: boolean;
}

const DEFAULT_WEBHOOK_SETTINGS: Record<string, boolean> = {
  notify_on_authorized: true,
  notify_on_confirmed: true,
  notify_on_rejected: true,
  notify_on_refunded: true,
  notify_on_canceled: true
};

const TBANK_NOTIFY_OPTIONS = [
  { key: 'notify_on_authorized', label: 'Авторизован (AUTHORIZED)' },
  { key: 'notify_on_confirmed', label: 'Подтверждён (CONFIRMED)' },
  { key: 'notify_on_rejected', label: 'Отклонён (REJECTED)' },
  { key: 'notify_on_refunded', label: 'Возврат (REFUNDED)' },
  { key: 'notify_on_canceled', label: 'Отменён (CANCELED)' }
];

const BANK_ACCOUNT_FIELDS: FieldConfig[] = [
  { key: 'account_number', label: 'Номер расчётного счёта', type: 'text', placeholder: '40702810000000000000' },
  { key: 'inn', label: 'ИНН организации', type: 'text', placeholder: '1234567890' },
  { key: 'api_token', label: 'Токен API банка', type: 'password', hint: 'Получите в личном кабинете банка в разделе API/интеграции' }
];

const PROVIDER_FIELDS: Record<string, FieldConfig[]> = {
  tbank: [
    { key: 'terminal_id', label: 'Terminal ID', type: 'text', placeholder: '1234567890', hint: 'Найдите в ЛК Т-Банк → Настройки → Терминалы' },
    { key: 'terminal_password', label: 'Terminal Password', type: 'password', placeholder: '•••••••••' }
  ],
  ofdru: [
    { key: 'api_url', label: 'API сервер', type: 'text', placeholder: 'https://ofd.ru', default: 'https://ofd.ru', hint: 'Используйте https://demo.ofd.ru для тестирования' },
    { key: 'inn', label: 'ИНН организации', type: 'text', placeholder: '1234567890', hint: 'ИНН юридического лица (10 или 12 цифр)' },
    { key: 'kkt', label: 'Регистрационный номер ККТ', type: 'text', placeholder: '0000111122223333', hint: 'Номер контрольно-кассовой техники' },
    { key: 'auth_token', label: 'Токен API', type: 'password', hint: 'Получите в ЛК OFD.RU → Настройки → Управление передачей данных → Ключи доступа API OFD' }
  ],
  bitrix24: [
    { key: 'webhook_url', label: 'Входящий вебхук Битрикс24', type: 'text', placeholder: 'https://yourcompany.bitrix24.ru/rest/1/xxxxxxxxxx/', hint: 'Битрикс24 → Разработчикам → Другое → Входящий вебхук. Права: crm' },
    { key: 'sync_schedule', label: 'Обмен по расписанию', type: 'checkbox', default: true, required: false, hint: 'Клиенты и статусы синхронизируются сами, без кнопки' },
    { key: 'sync_interval_minutes', label: 'Как часто, минут', type: 'number', placeholder: '60', default: 60, required: false, hint: 'Реже — меньше нагрузки на Битрикс' }
  ],
  amocrm: [
    { key: 'subdomain', label: 'Поддомен AmoCRM', type: 'text', placeholder: 'yourcompany', hint: 'Из адреса вида yourcompany.amocrm.ru' },
    { key: 'api_key', label: 'Долгосрочный токен доступа', type: 'password', hint: 'AmoCRM → Настройки → Интеграции → Создать интеграцию' }
  ],
  tbank_account: BANK_ACCOUNT_FIELDS,
  tochka_account: BANK_ACCOUNT_FIELDS,
  modulbank_account: BANK_ACCOUNT_FIELDS
};

// Провайдеры, для которых наш сервис принимает входящие вебхуки.
// Только для них имеет смысл показывать URL для вебхука и переадресацию.
const PROVIDERS_WITH_INCOMING_WEBHOOK = ['tbank'];

const buildDefaultConfig = (slug: string): ConfigState => {
  const fields = PROVIDER_FIELDS[slug] || [];
  const config: ConfigState = {};
  fields.forEach((field) => {
    config[field.key] = field.default ?? (field.type === 'checkbox' ? false : '');
  });
  return config;
};

const AddIntegrationDialog = ({
  open,
  onOpenChange,
  categories,
  initialCategory,
  editingIntegration,
  allProviders,
  connectedProviderIds,
  companyId,
  onSuccess
}: AddIntegrationDialogProps) => {
  const getInitialStep = () => {
    if (editingIntegration) return 2;
    if (initialCategory) return 1;
    return 0;
  };

  const [step, setStep] = useState(getInitialStep());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(initialCategory);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    editingIntegration ? allProviders.find(p => p.id === editingIntegration.provider_id) || null : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [integrationName, setIntegrationName] = useState(editingIntegration?.integration_name || '');
  const [config, setConfig] = useState<ConfigState>(editingIntegration?.config || {});
  const [webhookSettings, setWebhookSettings] = useState(editingIntegration?.webhook_settings || DEFAULT_WEBHOOK_SETTINGS);
  const [forwardUrl, setForwardUrl] = useState(editingIntegration?.forward_url || '');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;

    if (editingIntegration) {
      const prov = allProviders.find(p => p.id === editingIntegration.provider_id) || null;
      setStep(2);
      setSelectedProvider(prov);
      setSelectedCategory(categories.find(c => c.providers.some(p => p.id === editingIntegration.provider_id)) || null);
      setIntegrationName(editingIntegration.integration_name || '');
      setConfig(editingIntegration.config || buildDefaultConfig(prov?.slug || ''));
      setWebhookSettings(editingIntegration.webhook_settings || DEFAULT_WEBHOOK_SETTINGS);
      setForwardUrl(editingIntegration.forward_url || '');
    } else {
      setStep(initialCategory ? 1 : 0);
      setSelectedCategory(initialCategory);
      setSelectedProvider(null);
      setIntegrationName('');
      setConfig({});
      setWebhookSettings(DEFAULT_WEBHOOK_SETTINGS);
      setForwardUrl('');
    }
    setWebhookUrl('');
    setVisiblePasswords({});
  }, [open, editingIntegration, initialCategory, allProviders, categories]);

  const handlePickCategory = (category: Category) => {
    setSelectedCategory(category);
    setStep(1);
  };

  const handlePickProvider = (prov: Provider) => {
    setSelectedProvider(prov);
    setConfig(buildDefaultConfig(prov.slug));
    setStep(2);
  };

  const acceptsIncomingWebhook = (slug?: string) => !!slug && PROVIDERS_WITH_INCOMING_WEBHOOK.includes(slug);

  const handleCreate = async () => {
    if (!selectedProvider) return;

    setIsLoading(true);
    try {
      if (editingIntegration) {
        const response = await fetch(functionUrls['integrations-update'], {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integration_id: editingIntegration.id,
            company_id: companyId,
            integration_name: integrationName,
            config,
            webhook_settings: webhookSettings,
            forward_url: acceptsIncomingWebhook(selectedProvider.slug) ? forwardUrl : ''
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          toast({ title: 'Интеграция обновлена' });
          handleFinish();
        } else {
          toast({
            title: 'Ошибка',
            description: data.error || 'Не удалось обновить',
            variant: 'destructive'
          });
        }
      } else {
        const response = await fetch(functionUrls['integrations-create'], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            provider_slug: selectedProvider.slug,
            integration_name: integrationName || selectedProvider.name,
            config,
            webhook_settings: webhookSettings,
            forward_url: acceptsIncomingWebhook(selectedProvider.slug) ? forwardUrl : ''
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setWebhookUrl(data.webhook_url || '');
          setStep(3);
          toast({
            title: 'Интеграция создана',
            description: 'Теперь настройте подключение на стороне сервиса'
          });
        } else {
          toast({
            title: 'Ошибка',
            description: data.error || 'Не удалось создать интеграцию',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        description: 'Проверьте интернет-соединение',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    setStep(0);
    setSelectedCategory(null);
    setSelectedProvider(null);
    setIntegrationName('');
    setConfig({});
    setWebhookUrl('');
    onSuccess();
    onOpenChange(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: 'Скопировано',
      description: 'URL скопирован в буфер обмена'
    });
  };

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const currentFields = selectedProvider ? PROVIDER_FIELDS[selectedProvider.slug] || [] : [];

  const isConfigValid = () => {
    if (!selectedProvider) return false;
    return currentFields
      .filter(field => field.required !== false)
      .every(field => {
        const value = config[field.key];
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
            onChange={(e) => setConfig({ ...config, [field.key]: e.target.checked })}
          />
          <span className="text-sm">{field.label}</span>
        </label>
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
            onChange={(e) => setConfig({
              ...config,
              [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value
            })}
            className={isPassword ? 'pr-10' : undefined}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => togglePasswordVisibility(field.key)}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingIntegration
              ? 'Редактирование интеграции'
              : step === 0
                ? 'Добавить интеграцию'
                : step === 1
                  ? selectedCategory?.name
                  : 'Настройка интеграции'}
          </DialogTitle>
          <DialogDescription>
            {editingIntegration
              ? 'Измените настройки интеграции'
              : step === 0
                ? 'Выберите, что подключаем — покажу только нужные настройки'
                : step === 1
                  ? selectedCategory?.description || 'Выберите сервис для подключения'
                  : 'Заполните данные для подключения'}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && !editingIntegration && (
          <div className="space-y-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handlePickCategory(category)}
                disabled={category.providers.length === 0}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name={category.icon as any} size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{category.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{category.description}</div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {category.providers.length} шт.
                </Badge>
              </button>
            ))}
          </div>
        )}

        {step === 1 && selectedCategory && !editingIntegration && (
          <div className="space-y-3">
            {selectedCategory.providers.map((prov) => {
              const isConnected = connectedProviderIds.includes(prov.id);
              return (
                <button
                  key={prov.id}
                  onClick={() => handlePickProvider(prov)}
                  className="w-full flex items-center justify-between gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{prov.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{prov.description}</div>
                  </div>
                  {isConnected && (
                    <Badge variant="outline" className="shrink-0">
                      Уже подключено
                    </Badge>
                  )}
                </button>
              );
            })}

            <div className="flex justify-start pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                <Icon name="ArrowLeft" size={14} className="mr-2" />
                К категориям
              </Button>
            </div>
          </div>
        )}

        {step === 2 && selectedProvider && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="integration_name">Название (для удобства)</Label>
              <Input
                id="integration_name"
                placeholder="Например: Терминал на кассе №1"
                value={integrationName}
                onChange={(e) => setIntegrationName(e.target.value)}
              />
            </div>

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
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, [key]: e.target.checked })}
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
                  onChange={(e) => setForwardUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Данные будут дублироваться на указанный адрес после сохранения в БД
                </p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              {!editingIntegration && (
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <Icon name="ArrowLeft" size={14} className="mr-2" />
                  Назад
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Отмена
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isLoading || !isConfigValid()}
                >
                  {isLoading ? (
                    editingIntegration ? 'Сохранение...' : 'Создание...'
                  ) : (
                    editingIntegration ? 'Сохранить' : 'Далее'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && selectedProvider && (
          <div className="space-y-4">
            <div className="bg-success/10 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="CheckCircle" className="text-success" size={20} />
                <span className="font-semibold text-success">
                  Интеграция создана!
                </span>
              </div>
            </div>

            {acceptsIncomingWebhook(selectedProvider.slug) ? (
              <>
                <div>
                  <Label>Ваш уникальный URL для вебхуков</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                    <Button onClick={copyToClipboard} variant="outline" size="icon">
                      <Icon name="Copy" size={16} />
                    </Button>
                  </div>
                </div>

                <div className="bg-info/10 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <Icon name="Info" className="text-info mt-0.5" size={18} />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground mb-2">
                        Инструкция по настройке:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Откройте личный кабинет сервиса</li>
                        <li>Перейдите в раздел уведомлений / вебхуков</li>
                        <li>Вставьте скопированный URL в поле "URL для уведомлений"</li>
                        <li>Выберите метод: POST</li>
                        <li>Сохраните настройки</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-info/10 p-4 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Icon name="Info" className="text-info mt-0.5" size={18} />
                  <p className="text-sm text-muted-foreground">
                    Интеграция подключена и начнёт синхронизацию данных автоматически.
                    Дополнительных действий на вашей стороне не требуется.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button onClick={handleFinish}>
                Готово
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddIntegrationDialog;