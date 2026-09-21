import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { revenueData, reconciliationData, paymentsData, recentTransactions } from './mockData';

interface DashboardStats {
  totalPayments: number;
  successfulPayments: number;
  paymentsRevenue: number;
  totalReceipts: number;
  receiptsSum: number;
  activeIntegrations: number;
}

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
  stats: DashboardStats;
  mounted: boolean;
}

const DashboardOverview = ({ stats, mounted }: DashboardOverviewProps) => {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground mb-2">Дашборд</h2>
        <p className="text-muted-foreground">Общая статистика и аналитика платежей</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="TrendingUp" size={16} />
              Выручка из платежей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-foreground">
              {stats.paymentsRevenue.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-success mt-1 flex items-center gap-1">
              <Icon name="CheckCircle" size={14} />
              {stats.successfulPayments} успешных
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="CreditCard" size={16} />
              Всего платежей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-foreground">{stats.totalPayments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Включая отмененные
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="Receipt" size={16} />
              Чеков
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-foreground">{stats.totalReceipts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Всего чеков
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="Plug" size={16} />
              Интеграции
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-primary">{stats.activeIntegrations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Активных
            </p>
          </CardContent>
        </Card>
      </div>

      {mounted && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="TrendingUp" size={20} />
              Динамика выручки
            </CardTitle>
            <CardDescription>Помесячная статистика за полгода</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="PieChart" size={20} />
              Статус сверки
            </CardTitle>
            <CardDescription>Распределение по статусам</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={reconciliationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {reconciliationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-4">
              {reconciliationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                        <Icon name={config.icon as any} size={20} className={config.text} />
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