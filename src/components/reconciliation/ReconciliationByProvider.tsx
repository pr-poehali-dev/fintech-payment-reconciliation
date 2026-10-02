import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const plural = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'платёж';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'платежа';
  return 'платежей';
};

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
          Успешные платежи по платёжным интеграциям; для шлюза Екомкассы — по видам оплат (СБП, эквайринг и т.п.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {providers.map(([provider, stats]) => (
            <div key={provider} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-foreground">{provider}</span>
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{formatMoney(stats.amount)}</div>
                <div className="text-xs text-muted-foreground">{stats.count} {plural(stats.count)}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReconciliationByProvider;
