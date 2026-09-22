import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import functionUrls from '../../../backend/func2url.json';

interface EcomkassaFetchReceiptBlockProps {
  integrationId: number;
}

type Mode = 'legacy_no' | 'order_id';

const EcomkassaFetchReceiptBlock = ({ integrationId }: EcomkassaFetchReceiptBlockProps) => {
  const [mode, setMode] = useState<Mode>('legacy_no');
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFetch = async () => {
    if (!value.trim()) return;

    setIsLoading(true);
    try {
      const body = mode === 'legacy_no'
        ? { integration_id: integrationId, legacy_no: value.trim() }
        : { integration_id: integrationId, order_id: value.trim() };

      const response = await fetch(functionUrls['ecomkassa-fetch-receipts'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Чек загружен',
          description: `Статус: ${data.status || 'получен'}, заказ №${data.order_id}`
        });
        setValue('');
      } else {
        toast({
          title: 'Ошибка загрузки',
          description: data.error || 'Не удалось найти чек',
          variant: 'destructive'
        });
      }
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-2 space-y-2">
      <div className="text-xs text-muted-foreground mb-1">
        <Icon name="Download" size={12} className="inline mr-1" />
        Загрузить чек
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          variant={mode === 'legacy_no' ? 'default' : 'outline'}
          size="sm"
          className="text-xs px-2 h-8"
          onClick={() => setMode('legacy_no')}
        >
          По внешнему номеру
        </Button>
        <Button
          type="button"
          variant={mode === 'order_id' ? 'default' : 'outline'}
          size="sm"
          className="text-xs px-2 h-8"
          onClick={() => setMode('order_id')}
        >
          По номеру транзакции
        </Button>
      </div>
      <div>
        <Label htmlFor={`ecomkassa_receipt_value_${integrationId}`} className="sr-only">
          {mode === 'legacy_no' ? 'Внешний номер заказа' : 'Номер транзакции Екомкассы'}
        </Label>
        <div className="flex gap-2">
          <Input
            id={`ecomkassa_receipt_value_${integrationId}`}
            placeholder={mode === 'legacy_no' ? 'Например: 10004433339' : 'orderId из Екомкассы'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            onClick={handleFetch}
            disabled={isLoading || !value.trim()}
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
          >
            {isLoading ? (
              <Icon name="Loader2" className="animate-spin" size={14} />
            ) : (
              <Icon name="Search" size={14} />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {mode === 'order_id' && 'Поиск с опросом статуса, пока чек не будет фискализирован'}
        </p>
      </div>
    </div>
  );
};

export default EcomkassaFetchReceiptBlock;
