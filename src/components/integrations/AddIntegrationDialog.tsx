import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import functionUrls from '../../../backend/func2url.json';
import {
  Category,
  ConfigState,
  DEFAULT_WEBHOOK_SETTINGS,
  Provider,
  UserIntegration,
  acceptsIncomingWebhook,
  buildDefaultConfig
} from './providerFieldsConfig';
import IntegrationCategoryStep from './IntegrationCategoryStep';
import IntegrationProviderStep from './IntegrationProviderStep';
import IntegrationConfigStep from './IntegrationConfigStep';
import IntegrationSuccessStep from './IntegrationSuccessStep';

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

  const handleCreate = async () => {
    if (!selectedProvider) return;

    setIsLoading(true);
    try {
      const syncIntervalHours = config.sync_interval_hours
        ? Number(config.sync_interval_hours)
        : undefined;

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
            forward_url: acceptsIncomingWebhook(selectedProvider.slug) ? forwardUrl : '',
            sync_interval_hours: syncIntervalHours
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
            forward_url: acceptsIncomingWebhook(selectedProvider.slug) ? forwardUrl : '',
            sync_interval_hours: syncIntervalHours
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
          <IntegrationCategoryStep
            categories={categories}
            onSelectCategory={handlePickCategory}
          />
        )}

        {step === 1 && selectedCategory && !editingIntegration && (
          <IntegrationProviderStep
            selectedCategory={selectedCategory}
            connectedProviderIds={connectedProviderIds}
            onSelectProvider={handlePickProvider}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && selectedProvider && (
          <IntegrationConfigStep
            selectedProvider={selectedProvider}
            isEditing={!!editingIntegration}
            companyId={companyId}
            integrationName={integrationName}
            onIntegrationNameChange={setIntegrationName}
            config={config}
            onConfigChange={setConfig}
            webhookSettings={webhookSettings}
            onWebhookSettingsChange={setWebhookSettings}
            forwardUrl={forwardUrl}
            onForwardUrlChange={setForwardUrl}
            visiblePasswords={visiblePasswords}
            onTogglePasswordVisibility={togglePasswordVisibility}
            isLoading={isLoading}
            onBack={() => setStep(1)}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleCreate}
          />
        )}

        {step === 3 && selectedProvider && (
          <IntegrationSuccessStep
            selectedProvider={selectedProvider}
            webhookUrl={webhookUrl}
            onCopyWebhookUrl={copyToClipboard}
            onFinish={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddIntegrationDialog;