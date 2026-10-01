import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { paymentsData, recentTransactions } from './mockData';

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px'
};

const TX_STATUS_CONFIG = {
  success: { bg: 'bg-success/20', text: 'text-success', icon: 'CheckCircle' },
  warning: { bg: 'bg-warning/20', text: 'text-warning', icon: 'AlertTriangle' },
  pending: { bg: 'bg-info/20', text: 'text-info', icon: 'Clock' }
} as const;

interface DashboardOverviewProps {
  mounted: boolean;
}

const DashboardOverview = ({ mounted }: DashboardOverviewProps) => {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground mb-2">Дашборд</h2>
        <p className="text-muted-foreground">Общая статистика и аналитика платежей</p>
      </div>

      {mounted && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="BarChart3" size={20} />
              Активность по дням недели
            </CardTitle>
            <CardDescription>Количество платежей за неделю</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Activity" size={20} />
              Последние транзакции
            </CardTitle>
            <CardDescription>Актуальные операции сегодня</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((tx) => {
                const config = TX_STATUS_CONFIG[tx.status as keyof typeof TX_STATUS_CONFIG] || TX_STATUS_CONFIG.pending;
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
                        <Icon name={config.icon} size={20} className={config.text} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.time}</p>
                      </div>
                    </div>
                    <div className={`text-right ${tx.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                      <p className="text-lg font-bold">
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ₽
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
};

export default DashboardOverview;