import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import {
  LineChart,
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

const SERIES = [
  { key: 'payments', name: 'Платежи', color: 'hsl(var(--primary))' },
  { key: 'receipts', name: 'Чеки касса', color: 'hsl(var(--info))' },
  { key: 'receipts_ofd', name: 'Чеки ОФД', color: '#a78bfa' },
  { key: 'bank', name: 'Деньги', color: 'hsl(var(--success))' },
  { key: 'commission', name: 'Комиссия', color: 'hsl(var(--warning))' }
];

const formatDay = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

const ReconciliationChart = ({ daily, onDayClick }: ReconciliationChartProps) => {
  const chartData = daily.map((d) => ({ ...d, dayLabel: formatDay(d.date) }));

  return (
    <Card className="lg:col-span-2 border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="BarChart3" size={20} />
          Динамика по дням
        </CardTitle>
        <CardDescription>
          Платежи, чеки кассы и ОФД, поступления на счёт и комиссия банка за выбранный период
          {onDayClick && ' · нажмите на день, чтобы открыть его транзакции'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            className={onDayClick ? 'cursor-pointer' : undefined}
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex ?? state?.activeIndex);
              const date = Number.isInteger(index) ? chartData[index]?.date : undefined;
              if (date && onDayClick) onDayClick(date);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dayLabel" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.key === 'payments' ? 3 : 2}
                dot={{ fill: s.color, r: s.key === 'payments' ? 5 : 3 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ReconciliationChart;
