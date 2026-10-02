import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { ConfigState } from './providerFieldsConfig';
import { shortPaymentKindName } from '@/lib/paymentKindName';
import functionUrls from '../../../backend/func2url.json';

interface PaymentType {
  id: number;
  code: number;
  description: string;
}

interface EcomkassaPaymentTypesPickerProps {
  companyId: number;
  config: ConfigState;
  onConfigChange: (config: ConfigState) => void;
}

const EcomkassaPaymentTypesPicker = ({ companyId, config, onConfigChange }: EcomkassaPaymentTypesPickerProps) => {
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cashRegisterConnected, setCashRegisterConnected] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const selectedIds = Array.isArray(config.payment_type_ids) ? (config.payment_type_ids as string[]) : [];

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`${functionUrls['ecomkassa-payment-types-list']}?company_id=${companyId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setCashRegisterConnected(data.cash_register_connected);
          setPaymentTypes(data.payment_types || []);
        } else {
          setError(data.error || 'Не удалось получить виды оплат');
        }
      } catch {
        setError('Проблема с подключением к серверу');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [companyId, reloadKey]);

  const toggle = (id: number) => {
    const idStr = String(id);
    const next = selectedIds.includes(idStr)
      ? selectedIds.filter((v) => v !== idStr)
      : [...selectedIds, idStr];
    onConfigChange({ ...config, payment_type_ids: next });
  };

  const retryButton = (
    <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
      <Icon name="RefreshCw" size={14} className="mr-2" />
      {error ? 'Повторить' : 'Обновить список'}
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon name="Loader2" size={14} className="animate-spin" />
        Загружаем виды оплат из Екомкассы...
      </div>
    );
  }

  if (!cashRegisterConnected) {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
        <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
        <div>
          Чтобы выбрать виды оплат, сначала подключите кассу «Екомкасса» — шлюз берёт
          из неё токен доступа. Можно продолжить без выбора и настроить позже.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-destructive">{error}</p>
        {retryButton}
      </div>
    );
  }

  if (paymentTypes.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Виды оплат для отслеживания</Label>
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
          <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
          <div>
            В кассе Екомкассы не подключено ни одного вида оплаты. Подключите нужные
            (СБП, эквайринг, рассрочку) в личном кабинете Екомкассы и нажмите «Обновить список».
            Пока список пуст, будут учитываться платежи по всем видам оплат.
          </div>
        </div>
        {retryButton}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Виды оплат для отслеживания</Label>
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {paymentTypes.map((type) => (
          <label key={type.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.includes(String(type.id))}
              onChange={() => toggle(type.id)}
            />
            <span className="text-sm">{shortPaymentKindName(type.description) || `Вид оплаты #${type.id}`}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Ничего не выбрано — будут учитываться платежи по всем видам оплат
      </p>
    </div>
  );
};

export default EcomkassaPaymentTypesPicker;