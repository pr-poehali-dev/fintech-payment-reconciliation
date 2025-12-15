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
  provider: Provider | null;
  editingIntegration: UserIntegration | null;
  allProviders: Provider[];
  ownerId: number;
  onSuccess: () => void;
}

const AddIntegrationDialog = ({ open, onOpenChange, provider, editingIntegration, allProviders, ownerId, onSuccess }: AddIntegrationDialogProps) => {
  const [step, setStep] = useState(editingIntegration ? 1 : 0);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(provider || (editingIntegration ? allProviders.find(p => p.id === editingIntegration.provider_id) || null : null));
  const [isLoading, setIsLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [integrationName, setIntegrationName] = useState(editingIntegration?.integration_name || '');
  const [config, setConfig] = useState(editingIntegration?.config || {
    terminal_id: '',
    terminal_password: ''
  });
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
        setStep(1);
        setSelectedProvider(allProviders.find(p => p.id === editingIntegration.provider_id) || null);
        setIntegrationName(editingIntegration.integration_name || '');
        setConfig(editingIntegration.config || { terminal_id: '', terminal_password: '' });
        setWebhookSettings(editingIntegration.webhook_settings || {
          notify_on_authorized: true,
          notify_on_confirmed: true,
          notify_on_rejected: true,
          notify_on_refunded: true,
          notify_on_canceled: true
        });
        setForwardUrl(editingIntegration.forward_url || '');
      } else {
        setStep(0);
        setSelectedProvider(provider);
        setIntegrationName('');
        setConfig({ terminal_id: '', terminal_password: '' });
        setWebhookSettings({
          notify_on_authorized: true,
          notify_on_confirmed: true,
          notify_on_rejected: true,
          notify_on_refunded: true
        });
        setForwardUrl('');
      }
      setWebhookUrl('');
    }
  }, [open, editingIntegration, provider, allProviders]);

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
            owner_id: ownerId,
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
            owner_id: ownerId,
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
          setStep(2);
          toast({
            title: 'Интеграция создана',
            description: 'Теперь настройте вебхук в личном кабинете банка'
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
    setSelectedProvider(null);
    setIntegrationName('');
    setConfig({ terminal_id: '', terminal_password: '' });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingIntegration ? 'Редактирование интеграции' : 'Добавление интеграции'}
          </DialogTitle>
          <DialogDescription>
            {editingIntegration ? 'Измените настройки интеграции' : 'Выберите провайдера и заполните настройки'}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && !editingIntegration && (
          <div className="space-y-4">
            <div>
              <Label>Выберите провайдера</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {allProviders.map((prov) => (
                  <Button
                    key={prov.id}
                    variant={selectedProvider?.id === prov.id ? 'default' : 'outline'}
                    className="h-auto py-4 flex-col gap-2"
                    onClick={() => {
                      setSelectedProvider(prov);
                      setStep(1);
                    }}
                  >
                    <span className="font-semibold">{prov.name}</span>
                    <span className="text-xs opacity-80">{prov.description}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {step === 1 && selectedProvider && (
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
                    value={config.terminal_id}
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
                    value={config.terminal_password}
                    onChange={(e) => setConfig({ ...config, terminal_password: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Уведомления о статусах платежей</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookSettings.notify_on_authorized}
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, notify_on_authorized: e.target.checked })}
                      />
                      <span className="text-sm">Авторизован (AUTHORIZED)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookSettings.notify_on_confirmed}
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, notify_on_confirmed: e.target.checked })}
                      />
                      <span className="text-sm">Подтверждён (CONFIRMED)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookSettings.notify_on_rejected}
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, notify_on_rejected: e.target.checked })}
                      />
                      <span className="text-sm">Отклонён (REJECTED)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookSettings.notify_on_refunded}
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, notify_on_refunded: e.target.checked })}
                      />
                      <span className="text-sm">Возврат (REFUNDED)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookSettings.notify_on_canceled}
                        onChange={(e) => setWebhookSettings({ ...webhookSettings, notify_on_canceled: e.target.checked })}
                      />
                      <span className="text-sm">Отменён (CANCELED)</span>
                    </label>
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
                  Вебхуки будут дублироваться на указанный адрес после сохранения в БД
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={isLoading || (selectedProvider.slug === 'tbank' && (!config.terminal_id || !config.terminal_password)) || (selectedProvider.slug === 'ofdru' && (!config.inn || !config.kkt || !config.auth_token))}
              >
                {isLoading ? (
                  editingIntegration ? 'Сохранение...' : 'Создание...'
                ) : (
                  editingIntegration ? 'Сохранить' : 'Далее'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="CheckCircle" className="text-green-600" size={20} />
                <span className="font-semibold text-green-800 dark:text-green-200">
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

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <Icon name="Info" className="text-blue-600 mt-0.5" size={18} />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Инструкция по настройке:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                    <li>Откройте личный кабинет Т-Банк Эквайринг</li>
                    <li>Перейдите в раздел: Настройки → Уведомления</li>
                    <li>Вставьте скопированный URL в поле "URL для уведомлений"</li>
                    <li>Выберите метод: POST</li>
                    <li>Сохраните настройки</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <input type="checkbox" id="webhook_configured" />
              <Label htmlFor="webhook_configured" className="cursor-pointer">
                Я настроил вебхук в личном кабинете
              </Label>
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