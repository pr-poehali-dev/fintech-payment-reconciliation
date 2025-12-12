import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: 'active' | 'pending' | 'blocked';
  modules: string[];
  lastActive: string;
}

interface Role {
  id: string;
  name: string;
  color: string;
  modules: string[];
  permissions: string[];
}

const modules = [
  { id: 'dashboard', name: 'Дашборд', icon: 'LayoutDashboard' },
  { id: 'payments', name: 'Платежи', icon: 'CreditCard' },
  { id: 'receipts', name: 'Чеки', icon: 'Receipt' },
  { id: 'reconciliation', name: 'Сверка', icon: 'GitCompare' },
  { id: 'integrations', name: 'Интеграции', icon: 'Plug' },
  { id: 'access', name: 'Управление доступом', icon: 'Users' },
  { id: 'settings', name: 'Настройки', icon: 'Settings' }
];

const initialRoles: Role[] = [
  {
    id: 'owner',
    name: 'Owner',
    color: 'bg-purple-500',
    modules: modules.map(m => m.id),
    permissions: ['full_access', 'manage_users', 'manage_roles', 'delete_data']
  },
  {
    id: 'admin',
    name: 'Администратор',
    color: 'bg-blue-500',
    modules: ['dashboard', 'payments', 'receipts', 'reconciliation', 'integrations', 'access'],
    permissions: ['view_all', 'edit_all', 'manage_users']
  },
  {
    id: 'accountant',
    name: 'Бухгалтер',
    color: 'bg-green-500',
    modules: ['dashboard', 'payments', 'receipts', 'reconciliation'],
    permissions: ['view_all', 'edit_payments', 'export_data']
  },
  {
    id: 'operator',
    name: 'Оператор',
    color: 'bg-orange-500',
    modules: ['dashboard', 'payments', 'receipts'],
    permissions: ['view_own', 'edit_own']
  }
];

const initialUsers: User[] = [
  {
    id: 1,
    fullName: 'Иван Петров',
    email: 'ivan@company.ru',
    phone: '+7 (999) 123-45-67',
    role: 'owner',
    status: 'active',
    modules: modules.map(m => m.id),
    lastActive: '5 мин назад'
  },
  {
    id: 2,
    fullName: 'Мария Смирнова',
    email: 'maria@company.ru',
    phone: '+7 (999) 234-56-78',
    role: 'admin',
    status: 'active',
    modules: ['dashboard', 'payments', 'receipts', 'reconciliation', 'integrations'],
    lastActive: '1 час назад'
  },
  {
    id: 3,
    fullName: 'Ольга Кузнецова',
    email: 'olga@company.ru',
    phone: '+7 (999) 345-67-89',
    role: 'accountant',
    status: 'active',
    modules: ['dashboard', 'payments', 'receipts', 'reconciliation'],
    lastActive: '3 часа назад'
  },
  {
    id: 4,
    fullName: 'Алексей Новиков',
    email: 'alexey@company.ru',
    phone: '+7 (999) 456-78-90',
    role: 'operator',
    status: 'pending',
    modules: ['dashboard', 'payments'],
    lastActive: 'Не заходил'
  }
];

const AccessManagement = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [roles] = useState<Role[]>(initialRoles);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  
  const [newUser, setNewUser] = useState({
    phone: '+7',
    fullName: '',
    email: '',
    role: '',
    messenger: 'telegram' as 'telegram' | 'whatsapp' | 'max'
  });

  const [newRole, setNewRole] = useState({
    name: '',
    color: 'bg-blue-500',
    modules: [] as string[],
    permissions: [] as string[]
  });

  const generateInviteLink = () => {
    const token = Math.random().toString(36).substring(2, 15);
    const link = `https://finsync.app/invite/${token}`;
    setInviteLink(link);
  };

  const handleInviteUser = () => {
    if (newUser.phone && newUser.fullName && newUser.role) {
      generateInviteLink();
      const user: User = {
        id: users.length + 1,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        status: 'pending',
        modules: roles.find(r => r.id === newUser.role)?.modules || [],
        lastActive: 'Не заходил'
      };
      setUsers([...users, user]);
    }
  };

  const getRoleInfo = (roleId: string) => {
    return roles.find(r => r.id === roleId) || roles[0];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleUserStatus = (userId: number) => {
    setUsers(users.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === 'active' ? 'blocked' : 'active' as 'active' | 'pending' | 'blocked' }
        : u
    ));
  };

  const deleteUser = (userId: number) => {
    setUsers(users.filter(u => u.id !== userId));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Управление доступом</h2>
          <p className="text-muted-foreground">Роли, пользователи и права доступа</p>
        </div>
        
        <div className="flex gap-3">
          <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Icon name="Shield" size={16} />
                Создать роль
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Создать новую роль</DialogTitle>
                <DialogDescription>
                  Настройте права доступа и модули для новой роли
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Название роли</Label>
                  <Input
                    placeholder="Например: Менеджер по продажам"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Доступные модули</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {modules.map((module) => (
                      <div key={module.id} className="flex items-center gap-2">
                        <Switch
                          checked={newRole.modules.includes(module.id)}
                          onCheckedChange={(checked) => {
                            setNewRole({
                              ...newRole,
                              modules: checked
                                ? [...newRole.modules, module.id]
                                : newRole.modules.filter(m => m !== module.id)
                            });
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Icon name={module.icon as any} size={16} />
                          <span className="text-sm">{module.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    setShowRoleDialog(false);
                    setNewRole({ name: '', color: 'bg-blue-500', modules: [], permissions: [] });
                  }}
                  className="w-full"
                >
                  Создать роль
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Icon name="UserPlus" size={16} />
                Пригласить пользователя
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Пригласить пользователя</DialogTitle>
                <DialogDescription>
                  Отправьте приглашение через мессенджер
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Номер телефона</Label>
                  <Input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>ФИО</Label>
                  <Input
                    placeholder="Иван Иванов"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email (опционально)</Label>
                  <Input
                    type="email"
                    placeholder="ivan@company.ru"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Роль</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.id !== 'owner').map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${role.color}`} />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Отправить приглашение через</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {['telegram', 'whatsapp', 'max'].map((messenger) => (
                      <button
                        key={messenger}
                        onClick={() => setNewUser({ ...newUser, messenger: messenger as any })}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          newUser.messenger === messenger
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon 
                          name={messenger === 'telegram' ? 'Send' : messenger === 'whatsapp' ? 'MessageCircle' : 'Mail'} 
                          size={20}
                          className={newUser.messenger === messenger ? 'text-primary' : 'text-muted-foreground'}
                        />
                        <span className="text-xs capitalize">{messenger}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {inviteLink && (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <Label className="text-xs">Ссылка-приглашение создана</Label>
                    <div className="flex gap-2">
                      <Input value={inviteLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(inviteLink)}>
                        <Icon name="Copy" size={16} />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Приглашение отправлено в {newUser.messenger}
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleInviteUser}
                  disabled={!newUser.phone || !newUser.fullName || !newUser.role}
                  className="w-full"
                >
                  {inviteLink ? 'Отправить ещё одно приглашение' : 'Отправить приглашение'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <Card key={role.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className={`w-3 h-3 rounded-full ${role.color}`} />
                <Badge variant="secondary">
                  {users.filter(u => u.role === role.id).length}
                </Badge>
              </div>
              <CardTitle className="text-lg">{role.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {role.modules.length} модулей
                </div>
                <div className="flex flex-wrap gap-1">
                  {role.modules.slice(0, 3).map((moduleId) => {
                    const module = modules.find(m => m.id === moduleId);
                    return module ? (
                      <Badge key={moduleId} variant="outline" className="text-xs">
                        <Icon name={module.icon as any} size={12} className="mr-1" />
                        {module.name}
                      </Badge>
                    ) : null;
                  })}
                  {role.modules.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{role.modules.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>Управляйте доступом пользователей к системе</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Контакты</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Модули</TableHead>
                <TableHead>Последняя активность</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const roleInfo = getRoleInfo(user.role);
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Icon name="User" size={20} className="text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{user.fullName}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{user.phone}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${roleInfo.color} text-white`}>
                        {roleInfo.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        user.status === 'active' ? 'default' :
                        user.status === 'pending' ? 'secondary' :
                        'destructive'
                      }>
                        {user.status === 'active' ? 'Активен' :
                         user.status === 'pending' ? 'Ожидает' :
                         'Заблокирован'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.modules.slice(0, 3).map((moduleId) => {
                          const module = modules.find(m => m.id === moduleId);
                          return module ? (
                            <Icon key={moduleId} name={module.icon as any} size={16} className="text-muted-foreground" />
                          ) : null;
                        })}
                        {user.modules.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{user.modules.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{user.lastActive}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.role !== 'owner' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => toggleUserStatus(user.id)}
                            >
                              <Icon name={user.status === 'active' ? 'Ban' : 'CheckCircle'} size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteUser(user.id)}
                            >
                              <Icon name="Trash2" size={16} className="text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessManagement;
