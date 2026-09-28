import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface ProviderStats {
  amount: number;
  count: number;
}

interface ReconciliationByProviderProps {
  paymentsByProvider: Record<string, ProviderStats>;
}

const formatMoney = (value: number) =>
  value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 });

const ReconciliationByProvider = ({ paymentsByProvider }: ReconciliationByProviderProps) => {
  const providers = Object.entries(paymentsByProvider).sort((a, b) => b[1].amount - a[1].amount);

  if (providers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Wallet" size={18} />
          Детализация по видам оплат
        </CardTitle>
        <CardDescription>
          Разбивка платежей шлюза Екомкассы по конкретной платёжной системе (ЮKassa, СБП и т.п.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {providers.map(([provider, stats]) => (
            <div key={provider} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-foreground">{provider}</span>
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{formatMoney(stats.amount)}</div>
                <div className="text-xs text-muted-foreground">{stats.count} платежей</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReconciliationByProvider;
