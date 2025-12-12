import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import NotificationCenter from '@/components/NotificationCenter';
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

const revenueData = [
  { month: 'Янв', amount: 4200 },
  { month: 'Фев', amount: 5100 },
  { month: 'Мар', amount: 4800 },
  { month: 'Апр', amount: 6200 },
  { month: 'Май', amount: 7500 },
  { month: 'Июн', amount: 8200 }
];

const reconciliationData = [
  { name: 'Сверено', value: 85, color: 'hsl(var(--primary))' },
  { name: 'Расхождения', value: 12, color: 'hsl(var(--accent))' },
  { name: 'Ожидают', value: 3, color: 'hsl(var(--muted))' }
];

const paymentsData = [
  { day: 'Пн', count: 45 },
  { day: 'Вт', count: 52 },
  { day: 'Ср', count: 48 },
  { day: 'Чт', count: 61 },
  { day: 'Пт', count: 55 },
  { day: 'Сб', count: 28 },
  { day: 'Вс', count: 15 }
];

const recentTransactions = [
  { id: 1, description: 'Оплата от ООО "Ромашка"', amount: 125000, status: 'success', time: '10:24' },
  { id: 2, description: 'Платеж ИП Иванов', amount: 45000, status: 'pending', time: '09:45' },
  { id: 3, description: 'Возврат товара', amount: -12000, status: 'warning', time: '09:12' },
  { id: 4, description: 'Оплата услуг', amount: 78500, status: 'success', time: '08:56' }
];

const Index = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [mounted, setMounted] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount] = useState(3);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modules = [
    { id: 'dashboard', name: 'Дашборд', icon: 'LayoutDashboard' },
    { id: 'payments', name: 'Платежи', icon: 'CreditCard' },
    { id: 'receipts', name: 'Чеки', icon: 'Receipt' },
    { id: 'reconciliation', name: 'Сверка', icon: 'GitCompare' },
    { id: 'integrations', name: 'Интеграции', icon: 'Plug' },
    { id: 'access', name: 'Доступ', icon: 'Users' },
    { id: 'settings', name: 'Настройки', icon: 'Settings' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}
      
      <header className="fixed top-0 left-64 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border z-40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-foreground">
            {modules.find(m => m.id === activeModule)?.name || 'Дашборд'}
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Icon name="Download" size={16} />
            Экспорт
          </Button>
          
          <div className="relative">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowNotifications(true)}
              className="relative"
            >
              <Icon name="Bell" size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-scale-in">
                  {unreadCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border p-4 animate-slide-in-right">
        <div className="mb-8">
          <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
            <Icon name="Zap" size={28} />
            FinSync
          </h1>
          <p className="text-sm text-sidebar-foreground/60 mt-1">Автоматизация платежей</p>
        </div>

        <nav className="space-y-2">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeModule === module.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg scale-105'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <Icon name={module.icon as any} size={20} />
              <span className="font-medium">{module.name}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <Card className="bg-sidebar-accent border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Icon name="User" size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground">Иван Петров</p>
                  <p className="text-xs text-sidebar-foreground/60">ivan@company.ru</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>

      <main className="ml-64 mt-16 p-8">
        {activeModule === 'dashboard' && (
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
                    Выручка за месяц
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold text-foreground">8.2М ₽</div>
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Icon name="ArrowUp" size={14} />
                    +12.5% за месяц
                  </p>
                </CardContent>
              </Card>

              <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300" style={{ animationDelay: '0.1s' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Icon name="CreditCard" size={16} />
                    Платежей сегодня
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold text-foreground">127</div>
                  <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                    <Icon name="Clock" size={14} />
                    23 в обработке
                  </p>
                </CardContent>
              </Card>

              <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Icon name="GitCompare" size={16} />
                    Автосверка
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold text-foreground">98.4%</div>
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Icon name="CheckCircle" size={14} />
                    1,247 сверено
                  </p>
                </CardContent>
              </Card>

              <Card className="animate-scale-in border-border bg-card hover:shadow-xl transition-shadow duration-300" style={{ animationDelay: '0.3s' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Icon name="AlertCircle" size={16} />
                    Расхождения
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold text-accent">12</div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Icon name="Eye" size={14} />
                    Требуют внимания
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
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
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
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
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
                        {recentTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                tx.status === 'success' ? 'bg-green-500/20' :
                                tx.status === 'warning' ? 'bg-yellow-500/20' :
                                'bg-blue-500/20'
                              }`}>
                                <Icon
                                  name={
                                    tx.status === 'success' ? 'CheckCircle' :
                                    tx.status === 'warning' ? 'AlertTriangle' :
                                    'Clock'
                                  }
                                  size={20}
                                  className={
                                    tx.status === 'success' ? 'text-green-500' :
                                    tx.status === 'warning' ? 'text-yellow-500' :
                                    'text-blue-500'
                                  }
                                />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{tx.description}</p>
                                <p className="text-xs text-muted-foreground">{tx.time}</p>
                              </div>
                            </div>
                            <div className={`text-right ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              <p className="text-lg font-bold">
                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ₽
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {activeModule === 'payments' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Платежи</h2>
              <p className="text-muted-foreground">Управление входящими и исходящими платежами</p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center">
                <Icon name="CreditCard" size={64} className="mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-display font-bold mb-2">Модуль платежей</h3>
                <p className="text-muted-foreground">Здесь будет управление платежами</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeModule === 'receipts' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Чеки</h2>
              <p className="text-muted-foreground">Учет и обработка кассовых чеков</p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center">
                <Icon name="Receipt" size={64} className="mx-auto mb-4 text-secondary" />
                <h3 className="text-xl font-display font-bold mb-2">Модуль чеков</h3>
                <p className="text-muted-foreground">Здесь будет работа с чеками</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeModule === 'reconciliation' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Сверка</h2>
              <p className="text-muted-foreground">Автоматическая сверка платежей с чеками</p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center">
                <Icon name="GitCompare" size={64} className="mx-auto mb-4 text-accent" />
                <h3 className="text-xl font-display font-bold mb-2">Модуль автосверки</h3>
                <p className="text-muted-foreground">Здесь будет интерфейс сверки</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeModule === 'integrations' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Интеграции</h2>
              <p className="text-muted-foreground">Подключение банков и сервисов</p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center">
                <Icon name="Plug" size={64} className="mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-display font-bold mb-2">Модуль интеграций</h3>
                <p className="text-muted-foreground">Здесь будет настройка подключений</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeModule === 'access' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Управление доступом</h2>
              <p className="text-muted-foreground">Роли и права пользователей</p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center">
                <Icon name="Users" size={64} className="mx-auto mb-4 text-secondary" />
                <h3 className="text-xl font-display font-bold mb-2">Модуль доступа</h3>
                <p className="text-muted-foreground">Здесь будет управление правами</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeModule === 'settings' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-3xl font-display font-bold text-foreground mb-2">Настройки</h2>
              <p className="text-muted-foreground">Конфигурация системы и параметры</p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-12 text-center">
                <Icon name="Settings" size={64} className="mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-display font-bold mb-2">Модуль настроек</h3>
                <p className="text-muted-foreground">Здесь будут параметры системы</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;