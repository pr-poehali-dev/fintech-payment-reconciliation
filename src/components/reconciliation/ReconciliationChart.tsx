import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface DailyPoint {
  date: string;
  payments: number;
  receipts: number;
  receipts_ofd?: number;
  bank: number;
  commission?: number;
}

interface ReconciliationChartProps {
  daily: DailyPoint[];
  onDayClick?: (date: string) => void;
}

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px'
};

const formatDay = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const formatAxis = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}м`;
  if (Math.abs(value) >= 1000) return `${+(value / 1000).toFixed(1)}к`;
  return String(value);
};

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

const ReconciliationChart = ({ daily, onDayClick }: ReconciliationChartProps) => {
  // Выручка дня - реально полученные на счёт деньги ДО вычета комиссии банка
  // (поле bank уже включает комиссию обратно, нетто с учётом возвратов).
  const chartData = daily.map((d) => ({ ...d, revenue: d.bank, dayLabel: formatDay(d.date) }));

  return (
    <Card className="lg:col-span-2 border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-xl sm:text-2xl leading-tight">
          <Icon name="BarChart3" size={20} className="shrink-0 mt-1" />
          Динамика по дням
        </CardTitle>
        <CardDescription>
          Платежи, чеки кассы и ОФД, поступления на счёт и комиссия банка; линия — выручка: деньги на счёте до вычета комиссии
          {onDayClick && ' · нажмите на день, чтобы открыть его транзакции'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
            barCategoryGap="15%"
            data={chartData}
            className={onDayClick ? 'cursor-pointer' : undefined}
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex ?? state?.activeIndex);
              const date = Number.isInteger(index) ? chartData[index]?.date : undefined;
              if (date && onDayClick) onDayClick(date);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dayLabel" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={formatAxis} width={40} />
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} formatter={(v: number) => formatMoney(v)} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="payments" name="Платежи" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipts" name="Чеки касса" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipts_ofd" name="Чеки ОФД" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="bank" name="Деньги" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="commission" name="Комиссия" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Выручка"
              stroke="#f472b6"
              strokeWidth={1.5}
              dot={{ fill: '#f472b6', r: 2 }}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ReconciliationChart;
