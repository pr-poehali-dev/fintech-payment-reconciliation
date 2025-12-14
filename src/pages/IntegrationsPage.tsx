import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import AddIntegrationDialog from '@/components/integrations/AddIntegrationDialog';
import functionUrls from '../../backend/func2url.json';

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
  providers: Provider[];
}

interface UserIntegration {
  id: number;
  integration_name: string;
  webhook_token: string;
  status: string;
  webhook_count: number;
  last_webhook_at: string | null;
  created_at: string;
  provider_name: string;
  provider_slug: string;
  category_slug: string;
}

const IntegrationsPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const ownerId = 1;

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${functionUrls['integrations-list']}?owner_id=${ownerId}`);
      const data = await response.json();

      if (response.ok) {
        setCategories(data.categories || []);
        setUserIntegrations(data.user_integrations || []);
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить интеграции',
          variant: 'destructive'
        });
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

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleAddProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowAddDialog(true);
  };

  const copyWebhookUrl = (token: string) => {
    const url = `https://functions.poehali.dev/${functionUrls['webhook-receive'].split('/').pop()}/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Скопировано',
      description: 'URL вебхука скопирован в буфер обмена'
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Загрузка интеграций...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Интеграции</h2>
          <p className="text-muted-foreground">Подключите банки, кассы и другие системы</p>
        </div>
      </div>

      {userIntegrations.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Активные интеграции</h3>
          <div className="grid gap-4">
            {userIntegrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{integration.integration_name}</CardTitle>
                      <CardDescription>{integration.provider_name}</CardDescription>
                    </div>
                    <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                      {integration.status === 'active' ? 'Активно' : 'Неактивно'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Последний вебхук:</span>
                    <span className="font-medium">{formatDate(integration.last_webhook_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Всего вебхуков:</span>
                    <span className="font-medium">{integration.webhook_count}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">Webhook URL:</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyWebhookUrl(integration.webhook_token)}
                      >
                        <Icon name="Copy" size={14} />
                      </Button>
                    </div>
                    <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                      {`${functionUrls['webhook-receive']}/${integration.webhook_token}`}
                    </code>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xl font-semibold mb-3">Доступные интеграции</h3>
        {categories.map((category) => (
          <div key={category.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Icon name={category.icon as any} size={20} />
              <h4 className="text-lg font-medium">{category.name}</h4>
            </div>

            {category.providers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.providers.map((provider) => {
                  const isConnected = userIntegrations.some(
                    (ui) => ui.provider_slug === provider.slug
                  );

                  return (
                    <Card key={provider.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                        <CardDescription className="text-sm">{provider.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isConnected ? (
                          <Badge variant="secondary" className="w-full justify-center">
                            <Icon name="CheckCircle" size={14} className="mr-1" />
                            Подключено
                          </Badge>
                        ) : (
                          <Button 
                            onClick={() => handleAddProvider(provider)}
                            className="w-full"
                            size="sm"
                          >
                            <Icon name="Plus" size={14} className="mr-1" />
                            Подключить
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Icon name="Package" size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Интеграции скоро появятся</p>
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      <AddIntegrationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        provider={selectedProvider}
        ownerId={ownerId}
        onSuccess={fetchIntegrations}
      />
    </div>
  );
};

export default IntegrationsPage;
