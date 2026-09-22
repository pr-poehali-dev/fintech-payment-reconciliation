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
  bank: number;
}

interface ReconciliationChartProps {
  daily: DailyPoint[];
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

const ReconciliationChart = ({ daily }: ReconciliationChartProps) => {
  const chartData = daily.map((d) => ({ ...d, dayLabel: formatDay(d.date) }));

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="BarChart3" size={20} />
          Динамика по дням
        </CardTitle>
        <CardDescription>Платежи, чеки и поступления на счёт за выбранный период</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="dayLabel" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend />
            <Bar dataKey="payments" name="Платежи" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipts" name="Чеки" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="bank" name="Деньги на р/с" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ReconciliationChart;
