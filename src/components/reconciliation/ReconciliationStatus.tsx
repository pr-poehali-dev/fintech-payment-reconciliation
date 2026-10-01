import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface StatusBucket {
  count: number;
  amount: number;
}

export interface StatusSummary {
  reconciled: StatusBucket;
  waiting: StatusBucket;
  no_receipt: StatusBucket;
  no_payment: StatusBucket;
}

interface ReconciliationStatusProps {
  summary: StatusSummary | null;
  isLoading: boolean;
  onOpenUnmatched?: () => void;
}

const ITEMS: { key: keyof StatusSummary; name: string; hint: string; color: string }[] = [
  { key: 'reconciled', name: 'Сверено', hint: 'Платёж и чек связаны', color: 'hsl(var(--success))' },
  { key: 'waiting', name: 'Ожидают чек', hint: 'Заказ в кассе ещё не пробит', color: 'hsl(var(--info))' },
  { key: 'no_receipt', name: 'Платёж без чека', hint: 'Нет ни чека, ни заказа', color: 'hsl(var(--destructive))' },
  { key: 'no_payment', name: 'Чек без платежа', hint: 'Наличные, другая касса или не связан', color: 'hsl(var(--warning))' }
];

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px'
};

const formatMoney = (v: number) =>
  v.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

const ReconciliationStatus = ({ summary, isLoading, onOpenUnmatched }: ReconciliationStatusProps) => {
  const total = summary ? ITEMS.reduce((acc, i) => acc + summary[i.key].count, 0) : 0;
  const data = summary
    ? ITEMS.map((i) => ({ name: i.name, value: summary[i.key].count, color: i.color })).filter((d) => d.value > 0)
    : [];
  const percent = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const problems = summary ? summary.no_receipt.count + summary.no_payment.count : 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="PieChart" size={20} />
          Статус сверки
        </CardTitle>
        <CardDescription>Документы за выбранный период</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && !summary ? (
          <div className="flex h-[250px] items-center justify-center">
            <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-center text-sm text-muted-foreground">
            За период нет платежей и чеков
          </div>
        ) : (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={data.length > 1 ? 4 : 0} dataKey="value">
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v} шт.`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-display font-bold text-foreground">{percent(summary!.reconciled.count)}%</span>
                <span className="text-xs text-muted-foreground">сверено</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {ITEMS.map((item) => {
                const bucket = summary![item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-2" title={item.hint}>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-sm text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <span className="font-medium">{bucket.count}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{formatMoney(bucket.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {problems > 0 && onOpenUnmatched && (
              <button
                type="button"
                onClick={onOpenUnmatched}
                className="mt-4 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Показать документы без связи
                <Icon name="ArrowRight" size={12} />
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReconciliationStatus;
