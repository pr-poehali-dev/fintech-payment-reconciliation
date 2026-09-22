import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface ReconciliationTotals {
  payments: { amount: number; count: number };
  receipts: { amount: number; count: number };
  bank: { amount: number; raw_amount: number; commission_amount: number; count: number };
}

interface ReconciliationTilesProps {
  totals: ReconciliationTotals;
}

const formatMoney = (value: number) =>
  value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 });

const diffLabel = (a: number, b: number) => {
  const diff = a - b;
  if (Math.abs(diff) < 0.01) return { text: 'Совпадает', color: 'text-success' };
  const sign = diff > 0 ? '+' : '';
  return { text: `${sign}${formatMoney(diff)}`, color: diff > 0 ? 'text-warning' : 'text-destructive' };
};

const ReconciliationTiles = ({ totals }: ReconciliationTilesProps) => {
  const paymentsVsReceipts = diffLabel(totals.payments.amount, totals.receipts.amount);
  const receiptsVsBank = diffLabel(totals.receipts.amount, totals.bank.amount);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon name="CreditCard" size={16} />
            Платежи из интеграций
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-foreground">
            {formatMoney(totals.payments.amount)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.payments.count} успешных транзакций
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon name="Receipt" size={16} />
            Чеки (касса + ОФД)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-foreground">
            {formatMoney(totals.receipts.amount)}
          </div>
          <p className={`text-xs mt-1 ${paymentsVsReceipts.color}`}>
            {totals.receipts.count} чеков · vs платежи: {paymentsVsReceipts.text}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon name="Landmark" size={16} />
            Деньги на р/с
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-foreground">
            {formatMoney(totals.bank.amount)}
          </div>
          <p className={`text-xs mt-1 ${receiptsVsBank.color}`}>
            {totals.bank.count} операций · vs чеки: {receiptsVsBank.text}
          </p>
          {totals.bank.commission_amount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              включая комиссию {formatMoney(totals.bank.commission_amount)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconciliationTiles;
