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

interface UserIntegration {
  id: number;
  integration_name: string;
  provider_id: number;
  config: any;
  webhook_settings: any;
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

const defaultConfigFor = (slug: string) => {
  switch (slug) {
    case 'tbank':
      return { terminal_id: '', terminal_password: '' };
    case 'ofdru':
      return { api_url: 'https://ofd.ru', inn: '', kkt: '', auth_token: '' };
    case 'bitrix24':
      return { webhook_url: '', sync_schedule: true, sync_interval_minutes: 60 };
    case 'amocrm':
      return { subdomain: '', api_key: '' };
    case 'tbank_account':
    case 'tochka_account':
    case 'modulbank_account':
      return { account_number: '', inn: '', api_token: '' };
    default:
      return {};
  }
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
  const [config, setConfig] = useState<any>(editingIntegration?.config || {});
  const [webhookSettings, setWebhookSettings] = useState(editingIntegration?.webhook_settings || {
    notify_on_authorized: true,
    notify_on_confirmed: true,
    notify_on_rejected: true,
    notify_on_refunded: true,
    notify_on_canceled: true
  });
  const [forwardUrl, setForwardUrl] = useState(editingIntegration?.forward_url || '');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (editingIntegration) {
        const prov = allProviders.find(p => p.id === editingIntegration.provider_id) || null;
        setStep(2);
        setSelectedProvider(prov);
        setSelectedCategory(categories.find(c => c.providers.some(p => p.id === editingIntegration.provider_id)) || null);
        setIntegrationName(editingIntegration.integration_name || '');
        setConfig(editingIntegration.config || defaultConfigFor(prov?.slug || ''));
        setWebhookSettings(editingIntegration.webhook_settings || {
          notify_on_authorized: true,
          notify_on_confirmed: true,
          notify_on_rejected: true,
          notify_on_refunded: true,
          notify_on_canceled: true
        });
        setForwardUrl(editingIntegration.forward_url || '');
      } else {
        setStep(initialCategory ? 1 : 0);
        setSelectedCategory(initialCategory);
        setSelectedProvider(null);
        setIntegrationName('');
        setConfig({});
        setWebhookSettings({
          notify_on_authorized: true,
          notify_on_confirmed: true,
          notify_on_rejected: true,
          notify_on_refunded: true,
          notify_on_canceled: true
        });
        setForwardUrl('');
      }
      setWebhookUrl('');
    }
  }, [open, editingIntegration, initialCategory, allProviders, categories]);

  const handlePickCategory = (category: Category) => {
    setSelectedCategory(category);
    setStep(1);
  };

  const handlePickProvider = (prov: Provider) => {
    setSelectedProvider(prov);
    setConfig(defaultConfigFor(prov.slug));
    setStep(2);
  };

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
            forward_url: forwardUrl
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
            forward_url: forwardUrl
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setWebhookUrl(data.webhook_url);
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

  const isConfigValid = () => {
    if (!selectedProvider) return false;
    switch (selectedProvider.slug) {
      case 'tbank':
        return !!config.terminal_id && !!config.terminal_password;
      case 'ofdru':
        return !!config.inn && !!config.kkt && !!config.auth_token;
      case 'bitrix24':
        return !!config.webhook_url;
      case 'amocrm':
        return !!config.subdomain && !!config.api_key;
      case 'tbank_account':
      case 'tochka_account':
      case 'modulbank_account':
        return !!config.account_number && !!config.api_token;
      default:
        return true;
    }
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

            {selectedProvider.slug === 'tbank' && (
              <>
                <div>
                  <Label htmlFor="terminal_id">Terminal ID</Label>
                  <Input
                    id="terminal_id"
                    placeholder="1234567890"
                    value={config.terminal_id || ''}
                    onChange={(e) => setConfig({ ...config, terminal_id: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Найдите в ЛК Т-Банк → Настройки → Терминалы
                  </p>
                </div>

                <div>
                  <Label htmlFor="terminal_password">Terminal Password</Label>
                  <Input
                    id="terminal_password"
                    type="password"
                    placeholder="•••••••••"
                    value={config.terminal_password || ''}
                    onChange={(e) => setConfig({ ...config, terminal_password: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Уведомления о статусах платежей</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'notify_on_authorized', label: 'Авторизован (AUTHORIZED)' },
                      { key: 'notify_on_confirmed', label: 'Подтверждён (CONFIRMED)' },
                      { key: 'notify_on_rejected', label: 'Отклонён (REJECTED)' },
                      { key: 'notify_on_refunded', label: 'Возврат (REFUNDED)' },
                      { key: 'notify_on_canceled', label: 'Отменён (CANCELED)' }
                    ].map(({ key, label }) => (
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
              </>
            )}

            {selectedProvider.slug === 'ofdru' && (
              <>
                <div>
                  <Label htmlFor="api_url">API сервер</Label>
                  <Input
                    id="api_url"
                    placeholder="https://ofd.ru"
                    value={config.api_url || 'https://ofd.ru'}
                    onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Используйте https://demo.ofd.ru для тестирования
                  </p>
                </div>

                <div>
                  <Label htmlFor="inn">ИНН организации</Label>
                  <Input
                    id="inn"
                    placeholder="1234567890"
                    value={config.inn || ''}
                    onChange={(e) => setConfig({ ...config, inn: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ИНН юридического лица (10 или 12 цифр)
                  </p>
                </div>

                <div>
                  <Label htmlFor="kkt">Регистрационный номер ККТ</Label>
                  <Input
                    id="kkt"
                    placeholder="0000111122223333"
                    value={config.kkt || ''}
                    onChange={(e) => setConfig({ ...config, kkt: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Номер контрольно-кассовой техники
                  </p>
                </div>

                <div>
                  <Label htmlFor="auth_token">Токен API</Label>
                  <Input
                    id="auth_token"
                    type="password"
                    placeholder="•••••••••"
                    value={config.auth_token || ''}
                    onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Получите в ЛК OFD.RU → Настройки → Управление передачей данных → Ключи доступа API OFD
                  </p>
                </div>
              </>
            )}

            {selectedProvider.slug === 'bitrix24' && (
              <>
                <div>
                  <Label htmlFor="webhook_url">Входящий вебхук Битрикс24</Label>
                  <Input
                    id="webhook_url"
                    placeholder="https://yourcompany.bitrix24.ru/rest/1/xxxxxxxxxx/"
                    value={config.webhook_url || ''}
                    onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Битрикс24 → Разработчикам → Другое → Входящий вебхук. Права: crm
                  </p>
                </div>

                <div>
                  <Label htmlFor="sync_interval">Обмен по расписанию, минут</Label>
                  <Input
                    id="sync_interval"
                    type="number"
                    placeholder="60"
                    value={config.sync_interval_minutes || 60}
                    onChange={(e) => setConfig({ ...config, sync_interval_minutes: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Клиенты и статусы синхронизируются сами, без кнопки
                  </p>
                </div>
              </>
            )}

            {selectedProvider.slug === 'amocrm' && (
              <>
                <div>
                  <Label htmlFor="subdomain">Поддомен AmoCRM</Label>
                  <Input
                    id="subdomain"
                    placeholder="yourcompany"
                    value={config.subdomain || ''}
                    onChange={(e) => setConfig({ ...config, subdomain: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Из адреса вида yourcompany.amocrm.ru
                  </p>
                </div>

                <div>
                  <Label htmlFor="api_key">Долгосрочный токен доступа</Label>
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="•••••••••"
                    value={config.api_key || ''}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    AmoCRM → Настройки → Интеграции → Создать интеграцию
                  </p>
                </div>
              </>
            )}

            {(selectedProvider.slug === 'tbank_account' || selectedProvider.slug === 'tochka_account' || selectedProvider.slug === 'modulbank_account') && (
              <>
                <div>
                  <Label htmlFor="account_number">Номер расчётного счёта</Label>
                  <Input
                    id="account_number"
                    placeholder="40702810000000000000"
                    value={config.account_number || ''}
                    onChange={(e) => setConfig({ ...config, account_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="bank_inn">ИНН организации</Label>
                  <Input
                    id="bank_inn"
                    placeholder="1234567890"
                    value={config.inn || ''}
                    onChange={(e) => setConfig({ ...config, inn: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="api_token">Токен API банка</Label>
                  <Input
                    id="api_token"
                    type="password"
                    placeholder="•••••••••"
                    value={config.api_token || ''}
                    onChange={(e) => setConfig({ ...config, api_token: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Получите в личном кабинете банка в разделе API/интеграции
                  </p>
                </div>
              </>
            )}

            {selectedProvider.slug !== 'ofdru' && (
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

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-success/10 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="CheckCircle" className="text-success" size={20} />
                <span className="font-semibold text-success">
                  Интеграция создана!
                </span>
              </div>
            </div>

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
