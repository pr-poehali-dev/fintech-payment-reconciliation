import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import AddIntegrationDialog from '@/components/integrations/AddIntegrationDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  provider_id: number;
  config: any;
  webhook_settings: any;
  forward_url?: string;
}

const IntegrationsPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<UserIntegration | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState<UserIntegration | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState<number | null>(null);
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
        
        const providers: Provider[] = [];
        (data.categories || []).forEach((cat: Category) => {
          providers.push(...cat.providers);
        });
        setAllProviders(providers);
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

  const handleAddNew = (category: Category) => {
    setSelectedCategory(category);
    setSelectedProvider(null);
    setEditingIntegration(null);
    setShowAddDialog(true);
  };

  const handleEdit = (integration: UserIntegration) => {
    const category = categories.find(c => c.slug === integration.category_slug);
    const provider = allProviders.find(p => p.id === integration.provider_id);
    setSelectedCategory(category || null);
    setSelectedProvider(provider || null);
    setEditingIntegration(integration);
    setShowAddDialog(true);
  };

  const handleDeleteClick = (integration: UserIntegration) => {
    setDeletingIntegration(integration);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIntegration) return;

    try {
      const response = await fetch(functionUrls['integrations-delete'], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: deletingIntegration.id, owner_id: ownerId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: 'Интеграция удалена' });
        fetchIntegrations();
        setShowDeleteDialog(false);
        setDeletingIntegration(null);
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось удалить',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        variant: 'destructive'
      });
    }
  };

  const copyWebhookUrl = (token: string) => {
    const url = `${functionUrls['webhook-receive']}?token=${token}`;
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

  const handleFetchReceipts = async (integrationId: number) => {
    setLoadingReceipts(integrationId);
    try {
      const response = await fetch(functionUrls['ofd-fetch-receipts'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integrationId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Чеки загружены',
          description: `Загружено ${data.inserted} из ${data.total_receipts} чеков`
        });
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось загрузить чеки',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка подключения',
        variant: 'destructive'
      });
    } finally {
      setLoadingReceipts(null);
    }
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

  const getCategoryIntegrations = (categorySlug: string) => {
    return userIntegrations.filter(ui => ui.category_slug === categorySlug);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Интеграции</h2>
          <p className="text-muted-foreground">Подключите банки, кассы и другие системы</p>
        </div>
      </div>

      {categories.map((category) => {
        const categoryIntegrations = getCategoryIntegrations(category.slug);
        
        return (
          <div key={category.id}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name={category.icon as any} size={20} />
                <h3 className="text-xl font-semibold">{category.name}</h3>
              </div>
              <Button onClick={() => handleAddNew(category)} size="sm">
                <Icon name="Plus" size={16} className="mr-2" />
                Добавить
              </Button>
            </div>

            {categoryIntegrations.length > 0 ? (
              <div className="grid gap-4 mb-6">
                {categoryIntegrations.map((integration) => {
                  const isOFD = integration.category_slug === 'ofd';
                  return (
                  <Card key={integration.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{integration.integration_name}</CardTitle>
                          <CardDescription>{integration.provider_name}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                            {integration.status === 'active' ? 'Активно' : 'Неактивно'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(integration)}
                          >
                            <Icon name="Settings" size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(integration)}
                          >
                            <Icon name="Trash2" size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isOFD ? (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">ИНН:</span>
                            <span className="font-medium font-mono">{integration.config?.inn || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">РНМ:</span>
                            <span className="font-medium font-mono">{integration.config?.kkt || '—'}</span>
                          </div>
                          <div className="pt-2">
                            <Button
                              onClick={() => handleFetchReceipts(integration.id)}
                              disabled={loadingReceipts === integration.id}
                              size="sm"
                              className="w-full"
                            >
                              {loadingReceipts === integration.id ? (
                                <>
                                  <Icon name="Loader2" className="animate-spin mr-2" size={16} />
                                  Загружаю...
                                </>
                              ) : (
                                <>
                                  <Icon name="Download" size={16} className="mr-2" />
                                  Загрузить чеки
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
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
                              {`${functionUrls['webhook-receive']}?token=${integration.webhook_token}`}
                            </code>
                          </div>
                          {integration.forward_url && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Переадресация: </span>
                              <span className="font-mono text-xs">{integration.forward_url}</span>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                )})}
              </div>
            ) : (
              <Card className="mb-6">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Icon name="Inbox" size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Пока нет интеграций в этой категории</p>
                  <Button onClick={() => handleAddNew(category)} variant="link" className="mt-2">
                    Добавить первую интеграцию
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })}

      <AddIntegrationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        provider={selectedProvider}
        editingIntegration={editingIntegration}
        allProviders={selectedCategory ? selectedCategory.providers : allProviders}
        ownerId={ownerId}
        onSuccess={fetchIntegrations}
      />

      {deletingIntegration && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить эту интеграцию?</AlertDialogTitle>
              <AlertDialogDescription>
                Вебхуки перестанут поступать. Интеграция <strong>{deletingIntegration.integration_name}</strong> будет удалена навсегда.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отменить</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default IntegrationsPage;