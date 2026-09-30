import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import {
  BarChart,
  Bar,
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

const ReconciliationChart = ({ daily, onDayClick }: ReconciliationChartProps) => {
  const chartData = daily.map((d) => ({ ...d, dayLabel: formatDay(d.date) }));

  return (
    <Card className="border-border bg-card">
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
          <BarChart
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
            <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
            <Legend />
            <Bar dataKey="payments" name="Платежи" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipts" name="Чеки касса" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipts_ofd" name="Чеки ОФД" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="bank" name="Деньги" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="commission" name="Комиссия" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ReconciliationChart;
