import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../backend/func2url.json';

interface CompanyLookupData {
  inn: string;
  kpp: string | null;
  ogrn: string;
  full_name: string;
  short_name: string;
  address: string;
}

const CreateCompany = () => {
  const { user, refreshCompanies, setCurrentCompanyId, logout } = useAuth();
  const { toast } = useToast();
  const [inn, setInn] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [foundCompany, setFoundCompany] = useState<CompanyLookupData | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!inn || inn.length < 10) return;

    setIsSearching(true);
    setSearchError(null);
    setFoundCompany(null);

    try {
      const response = await fetch(`${functionUrls['company-lookup-by-inn']}?inn=${inn}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setFoundCompany(data.company_data);
      } else {
        setSearchError(data.error || 'Не удалось найти компанию по этому ИНН');
      }
    } catch (error) {
      setSearchError('Проверьте интернет-соединение и попробуйте снова');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !foundCompany) return;

    setIsCreating(true);
    try {
      const response = await fetch(functionUrls['companies-create'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          name: foundCompany.short_name,
          inn: foundCompany.inn,
          kpp: foundCompany.kpp,
          ogrn: foundCompany.ogrn,
          full_name: foundCompany.full_name,
          legal_address: foundCompany.address
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await refreshCompanies();
        setCurrentCompanyId(data.company_id);
        toast({ title: 'Компания создана', description: data.name });
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
      setIsCreating(false);
    }
  };

  const handleInnChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setInn(digits);
    setFoundCompany(null);
    setSearchError(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center animate-fade-in">
          <a href="/" className="flex items-center justify-center gap-2 mb-2">
            <Icon name="Zap" size={32} className="text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Сверка</h1>
          </a>
          <p className="text-sm text-muted-foreground">Добавьте свою первую компанию</p>
        </div>

        <Card className="shadow-2xl border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display">Создание компании</CardTitle>
            <CardDescription className="text-base">
              Введите ИНН — мы найдём компанию автоматически
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>ИНН компании</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="7712345678"
                  value={inn}
                  onChange={(e) => handleInnChange(e.target.value)}
                  maxLength={12}
                  className="h-12"
                />
                <Button
                  onClick={handleSearch}
                  disabled={inn.length < 10 || isSearching}
                  variant="secondary"
                  className="h-12 px-4 shrink-0"
                >
                  {isSearching ? (
                    <Icon name="Loader2" size={18} className="animate-spin" />
                  ) : (
                    <Icon name="Search" size={18} />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">10 цифр для юрлица, 12 для ИП</p>
            </div>

            {searchError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <Icon name="AlertCircle" size={18} className="text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{searchError}</p>
              </div>
            )}

            {foundCompany && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20 animate-fade-in">
                <Icon name="CheckCircle2" size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Найдена компания</p>
                  <p className="font-semibold text-foreground">{foundCompany.short_name}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={!foundCompany || isCreating}
              className="w-full h-12 text-base font-semibold"
            >
              {isCreating ? (
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