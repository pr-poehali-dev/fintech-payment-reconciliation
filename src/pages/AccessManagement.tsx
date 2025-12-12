import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import functionUrls from '../../backend/func2url.json';
import RoleCard from '@/components/access/RoleCard';
import CreateRoleDialog from '@/components/access/CreateRoleDialog';
import InviteUserDialog from '@/components/access/InviteUserDialog';
import UsersTable from '@/components/access/UsersTable';

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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
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

  const handleInviteUser = async () => {
    if (newUser.phone && newUser.fullName && newUser.role) {
      setIsLoading(true);
      
      const providerMap: Record<string, string> = {
        'whatsapp': 'ek_wa',
        'telegram': 'ek_tg',
        'max': 'ek_max'
      };
      
      const token = Math.random().toString(36).substring(2, 15);
      const link = `https://finsync.app/invite/${token}`;
      
      try {
        const response = await fetch(functionUrls['send-message'], {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: providerMap[newUser.messenger],
            recipient: newUser.phone.replace(/\D/g, ''),
            message: `Привет, ${newUser.fullName}! Вас пригласили в FinSync.\n\nВаша ссылка для регистрации: ${link}\n\nРоль: ${roles.find(r => r.id === newUser.role)?.name}`
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          setInviteLink(link);
          
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
          
          toast({
            title: 'Приглашение отправлено',
            description: `Пользователь ${newUser.fullName} получит приглашение в ${newUser.messenger}`,
          });
        } else {
          toast({
            title: 'Ошибка отправки',
            description: data.error || 'Не удалось отправить приглашение',
            variant: 'destructive'
          });
        }
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Проблема с подключением к серверу',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    }
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
          <CreateRoleDialog
            open={showRoleDialog}
            onOpenChange={setShowRoleDialog}
            newRole={newRole}
            setNewRole={setNewRole}
            modules={modules}
          />

          <InviteUserDialog
            open={showInviteDialog}
            onOpenChange={setShowInviteDialog}
            newUser={newUser}
            setNewUser={setNewUser}
            roles={roles}
            inviteLink={inviteLink}
            isLoading={isLoading}
            onInvite={handleInviteUser}
            onCopyLink={copyToClipboard}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            userCount={users.filter(u => u.role === role.id).length}
            modules={modules}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>Управляйте доступом пользователей к системе</CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable
            users={users}
            roles={roles}
            modules={modules}
            onToggleStatus={toggleUserStatus}
            onDeleteUser={deleteUser}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessManagement;
