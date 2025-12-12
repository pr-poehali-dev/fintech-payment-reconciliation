import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';

interface Notification {
  id: number;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  category: 'payment' | 'reconciliation' | 'system';
}

const initialNotifications: Notification[] = [
  {
    id: 1,
    type: 'warning',
    title: 'Расхождение в сверке',
    message: 'Обнаружено расхождение в платеже №4512 на сумму 5,000 ₽',
    time: '5 мин назад',
    read: false,
    category: 'reconciliation'
  },
  {
    id: 2,
    type: 'success',
    title: 'Платеж получен',
    message: 'Поступил платеж от ООО "Ромашка" на сумму 125,000 ₽',
    time: '15 мин назад',
    read: false,
    category: 'payment'
  },
  {
    id: 3,
    type: 'error',
    title: 'Ошибка интеграции',
    message: 'Не удалось синхронизировать данные с банком Тинькофф',
    time: '1 час назад',
    read: false,
    category: 'system'
  },
  {
    id: 4,
    type: 'info',
    title: 'Автосверка завершена',
    message: 'Обработано 247 операций, сверено 98.4%',
    time: '2 часа назад',
    read: true,
    category: 'reconciliation'
  },
  {
    id: 5,
    type: 'warning',
    title: 'Повторная попытка платежа',
    message: 'Клиент ИП Иванов повторно отправил платеж №3421',
    time: '3 часа назад',
    read: true,
    category: 'payment'
  }
];

interface NotificationCenterProps {
  onClose: () => void;
}

const NotificationCenter = ({ onClose }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [messengerSettings, setMessengerSettings] = useState({
    telegram: true,
    whatsapp: false,
    email: true
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return { name: 'CheckCircle2', color: 'text-green-500' };
      case 'warning': return { name: 'AlertTriangle', color: 'text-yellow-500' };
      case 'error': return { name: 'XCircle', color: 'text-red-500' };
      case 'info': return { name: 'Info', color: 'text-blue-500' };
      default: return { name: 'Bell', color: 'text-muted-foreground' };
    }
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in">
      <div className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-background border-l border-border shadow-2xl animate-slide-in-right">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Icon name="Bell" size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-foreground">Уведомления</h2>
                  {unreadCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {unreadCount} непрочитанных
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <Icon name="X" size={20} />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('all')}
                className="flex-1"
              >
                Все
              </Button>
              <Button 
                variant={filter === 'unread' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilter('unread')}
                className="flex-1"
              >
                Непрочитанные
                {unreadCount > 0 && (
                  <Badge className="ml-2" variant="secondary">{unreadCount}</Badge>
                )}
              </Button>
            </div>

            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="w-full mt-2"
              >
                <Icon name="CheckCheck" size={16} className="mr-2" />
                Отметить все прочитанными
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="Inbox" size={48} className="mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {filter === 'unread' ? 'Нет непрочитанных уведомлений' : 'Уведомлений пока нет'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const icon = getIcon(notification.type);
                  return (
                    <Card 
                      key={notification.id} 
                      className={`transition-all cursor-pointer hover:shadow-md ${
                        !notification.read ? 'border-primary/50 bg-primary/5' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            notification.type === 'success' ? 'bg-green-500/20' :
                            notification.type === 'warning' ? 'bg-yellow-500/20' :
                            notification.type === 'error' ? 'bg-red-500/20' :
                            'bg-blue-500/20'
                          }`}>
                            <Icon name={icon.name as any} size={20} className={icon.color} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-foreground text-sm">
                                {notification.title}
                              </h4>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                              >
                                <Icon name="X" size={14} />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Icon name="Clock" size={12} />
                                {notification.time}
                              </span>
                              {!notification.read && (
                                <Badge variant="secondary" className="text-xs">Новое</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon name="MessageSquare" size={16} />
                  Отправка в мессенджеры
                </CardTitle>
                <CardDescription className="text-xs">
                  Получайте важные уведомления в ваши мессенджеры
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="Send" size={16} className="text-blue-500" />
                    <span className="text-sm">Telegram</span>
                  </div>
                  <Switch 
                    checked={messengerSettings.telegram}
                    onCheckedChange={(checked) => 
                      setMessengerSettings(prev => ({ ...prev, telegram: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="MessageCircle" size={16} className="text-green-500" />
                    <span className="text-sm">WhatsApp</span>
                  </div>
                  <Switch 
                    checked={messengerSettings.whatsapp}
                    onCheckedChange={(checked) => 
                      setMessengerSettings(prev => ({ ...prev, whatsapp: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="Mail" size={16} className="text-orange-500" />
                    <span className="text-sm">Email</span>
                  </div>
                  <Switch 
                    checked={messengerSettings.email}
                    onCheckedChange={(checked) => 
                      setMessengerSettings(prev => ({ ...prev, email: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;