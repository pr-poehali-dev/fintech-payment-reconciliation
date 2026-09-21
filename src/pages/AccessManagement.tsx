import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../backend/func2url.json';
import RoleCard from '@/components/access/RoleCard';
import CreateRoleDialog from '@/components/access/CreateRoleDialog';
import InviteUserDialog from '@/components/access/InviteUserDialog';
import UsersTable from '@/components/access/UsersTable';
import Icon from '@/components/ui/icon';

interface CompanyUser {
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string;
  role_slug: string;
  role_name: string;
  role_color: string;
  status: 'active' | 'pending' | 'blocked' | 'removed';
  invited_at: string | null;
  joined_at: string | null;
}

interface Role {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  modules: string[];
  permissions: string[];
  is_system: boolean;
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

const AccessManagement = () => {
  const { user, currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
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
    color: 'bg-info',
    modules: [] as string[],
    permissions: [] as string[]
  });

  const loadData = async () => {
    if (!companyId) return;
    setIsPageLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${functionUrls['company-users-list']}?company_id=${companyId}`),
        fetch(`${functionUrls['roles-list']}?scope=company`)
      ]);

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();

      if (usersRes.ok) setUsers(usersData.users || []);
      if (rolesRes.ok) setRoles(rolesData.roles || []);
    } catch (error) {
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить пользователей и роли',
        variant: 'destructive'
      });
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const handleInviteUser = async () => {
    if (!companyId || !newUser.phone || !newUser.fullName || !newUser.role) return;

    setIsLoading(true);

    const providerMap: Record<string, string> = {
      whatsapp: 'ek_wa',
      telegram: 'ek_tg',
      max: 'ek_max'
    };

    try {
      const inviteRes = await fetch(functionUrls['company-users-invite'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          phone: newUser.phone,
          full_name: newUser.fullName,
          role_slug: newUser.role,
          invited_by: user?.user_id
        })
      });

      const inviteData = await inviteRes.json();

      if (!inviteRes.ok || !inviteData.success) {
        toast({
          title: 'Ошибка приглашения',
          description: inviteData.error || 'Не удалось добавить пользователя',
          variant: 'destructive'
        });
        return;
      }

      const link = `https://ecomkassa.pro/invite/${companyId}`;
      setInviteLink(link);

      await fetch(functionUrls['send-message'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerMap[newUser.messenger],
          recipient: newUser.phone.replace(/\D/g, ''),
          message: `Привет, ${newUser.fullName}! Вас пригласили в Екомкасса ПРО (${currentCompany?.name}).\n\nВойдите по вашему номеру телефона: ${link}\n\nРоль: ${roles.find(r => r.slug === newUser.role)?.name}`
        })
      });

      toast({
        title: 'Приглашение отправлено',
        description: `Пользователь ${newUser.fullName} получит приглашение в ${newUser.messenger}`
      });

      loadData();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Проблема с подключением к серверу',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleUserStatus = async (userId: number) => {
    if (!companyId) return;
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const newStatus = targetUser.status === 'active' ? 'blocked' : 'active';

    try {
      const res = await fetch(functionUrls['company-users-update'], {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, user_id: userId, status: newStatus })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    }
  };

  const deleteUser = async (userId: number) => {
    if (!companyId) return;

    try {
      const res = await fetch(functionUrls['company-users-update'], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, user_id: userId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Загрузка доступов...</p>
        </div>
      </div>
    );
  }

  const rolesForUi = roles.map(r => ({
    id: r.slug,
    name: r.name,
    color: r.color,
    modules: r.modules,
    permissions: r.permissions
  }));

  const usersForUi = users
    .filter(u => u.status !== 'removed')
    .map(u => ({
      id: u.id,
      fullName: u.full_name || u.phone,
      email: u.email || '',
      phone: u.phone,
      role: u.role_slug,
      status: u.status as 'active' | 'pending' | 'blocked',
      modules: roles.find(r => r.slug === u.role_slug)?.modules || [],
      lastActive: u.joined_at ? new Date(u.joined_at).toLocaleDateString('ru-RU') : 'Не заходил'
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Управление доступом</h2>
          <p className="text-muted-foreground">Роли, пользователи и права доступа компании «{currentCompany?.name}»</p>
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
            roles={rolesForUi}
            inviteLink={inviteLink}
            isLoading={isLoading}
            onInvite={handleInviteUser}
            onCopyLink={copyToClipboard}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rolesForUi.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            userCount={users.filter(u => u.role_slug === role.id && u.status !== 'removed').length}
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
            users={usersForUi}
            roles={rolesForUi}
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
