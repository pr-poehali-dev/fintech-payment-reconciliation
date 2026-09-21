import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../backend/func2url.json';

const CreateCompany = () => {
  const { user, refreshCompanies, setCurrentCompanyId, logout } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [inn, setInn] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(functionUrls['companies-create'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          name: name.trim(),
          inn: inn.trim() || null
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await refreshCompanies();
        setCurrentCompanyId(data.company_id);
        toast({ title: 'Компания создана', description: name });
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось создать компанию',
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon name="Zap" size={32} className="text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Екомкасса ПРО</h1>
          </div>
          <p className="text-sm text-muted-foreground">Добавьте свою первую компанию</p>
        </div>

        <Card className="shadow-2xl border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display">Создание компании</CardTitle>
            <CardDescription className="text-base">
              По этой компании будем выполнять сверку платежей и чеков
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название компании</Label>
                <Input
                  placeholder="ООО «Ромашка»"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>ИНН (опционально)</Label>
                <Input
                  placeholder="7712345678"
                  value={inn}
                  onChange={(e) => setInn(e.target.value.replace(/\D/g, ''))}
                  maxLength={12}
                  className="h-12"
                />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || isLoading}
              className="w-full h-12 text-base font-semibold"
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Создание...
                </>
              ) : 'Создать компанию'}
            </Button>

            <Button variant="ghost" onClick={logout} className="w-full text-muted-foreground">
              Выйти из аккаунта
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateCompany;
