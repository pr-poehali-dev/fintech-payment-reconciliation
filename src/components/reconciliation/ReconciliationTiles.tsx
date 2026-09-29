import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface ReconciliationTotals {
  payments: { amount: number; count: number };
  receipts: { amount: number; count: number; ofd_amount?: number; ofd_count?: number };
  bank: { amount: number; raw_amount: number; commission_amount: number; count: number };
}

interface ReconciliationTilesProps {
  totals: ReconciliationTotals;
}

const formatMoney = (value: number) =>
  value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 });

// Плитка "Деньги" сравнивается с чеками по СУММЕ (а не количеству, там разные
// единицы - документы vs операции по счёту, включая комиссии отдельными
// строками) - "Всё в порядке" зелёным при совпадении, иначе разница оранжевым
// (это не обязательно ошибка - деньги приходят с опозданием, за прошлый период
// и т.п., поэтому не красный).
const bankVsReceiptsLabel = (bankAmount: number, receiptsAmount: number) => {
  const diff = bankAmount - receiptsAmount;
  if (Math.abs(diff) < 0.01) return { text: 'Всё в порядке', color: 'text-success' };
  const sign = diff > 0 ? '+' : '−';
  return { text: `разница ${sign}${formatMoney(Math.abs(diff))}`, color: 'text-warning' };
};

const ReconciliationTiles = ({ totals }: ReconciliationTilesProps) => {
  // Чеки кассы vs чеки ОФД сравниваются по КОЛИЧЕСТВУ документов - это два
  // разных источника одного и того же чека (касса пробивает сама, ОФД
  // получает копию от налоговой), поэтому расхождение в штуках красноречивее
  // расхождения в сумме (пропавший/задвоенный чек виден сразу).
  const ofdCount = totals.receipts.ofd_count;
  const kassaCountMatchesOfd = ofdCount !== undefined && ofdCount === totals.receipts.count;
  const bankVsReceipts = bankVsReceiptsLabel(totals.bank.amount, totals.receipts.amount);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon name="CreditCard" size={16} />
            Платежи
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-foreground">
            {formatMoney(totals.payments.amount)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.payments.count} транзакций
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon name="Receipt" size={16} />
            Чеки
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-foreground">
            {formatMoney(totals.receipts.amount)}
          </div>
          {ofdCount !== undefined && (
            <p className={`text-xs mt-1 ${kassaCountMatchesOfd ? 'text-success' : 'text-destructive'}`}>
              {totals.receipts.count} в кассе и {ofdCount} в ОФД
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon name="Landmark" size={16} />
            Деньги
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-display font-bold text-foreground">
            {formatMoney(totals.bank.amount)}
          </div>
          <p className={`text-xs mt-1 ${bankVsReceipts.color}`}>
            {bankVsReceipts.text}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconciliationTiles;
