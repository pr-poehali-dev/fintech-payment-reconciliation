import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { formatPhoneNumber, isValidPhone, isValidEmail } from '@/lib/formatters';
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

interface Role {
  id: string;
  name: string;
  color: string;
  modules: string[];
  permissions: string[];
}

type Channel = 'telegram' | 'whatsapp' | 'max' | 'email';

interface NewUser {
  phone: string;
  fullName: string;
  email: string;
  role: string;
  messenger: Channel;
}

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newUser: NewUser;
  setNewUser: (user: NewUser) => void;
  roles: Role[];
  inviteLink: string;
  isLoading: boolean;
  isLimitReached: boolean;
  onInvite: () => void;
  onCopyLink: (text: string) => void;
}

const channels: { id: Channel; icon: string; label: string }[] = [
  { id: 'telegram', icon: 'Send', label: 'Telegram' },
  { id: 'whatsapp', icon: 'MessageCircle', label: 'WhatsApp' },
  { id: 'max', icon: 'MessageSquare', label: 'Max' },
  { id: 'email', icon: 'Mail', label: 'Email' },
];

const InviteUserDialog = ({
  open,
  onOpenChange,
  newUser,
  setNewUser,
  roles,
  inviteLink,
  isLoading,
  isLimitReached,
  onInvite,
  onCopyLink
}: InviteUserDialogProps) => {
  const isEmailChannel = newUser.messenger === 'email';
  const canSubmit =
    isValidPhone(newUser.phone) &&
    !!newUser.fullName &&
    !!newUser.role &&
    isValidEmail(newUser.email) &&
    (!isEmailChannel || (!!newUser.email && isValidEmail(newUser.email))) &&
    !isLoading &&
    !isLimitReached;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={isLimitReached}>
          <Icon name="UserPlus" size={16} />
          Пригласить пользователя
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Пригласить пользователя</DialogTitle>
          <DialogDescription>
            Отправим одноразовую ссылку для вступления в компанию
          </DialogDescription>
        </DialogHeader>

        {isLimitReached ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
            <Icon name="AlertTriangle" size={20} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Лимит тарифа исчерпан</p>
              <p className="text-xs text-muted-foreground mt-1">
                Чтобы пригласить ещё одного пользователя, перейдите на другой тариф
              </p>
            </div>
          </div>
        ) : (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Номер телефона</Label>
            <Input
              type="tel"
              placeholder="+7 (___) ___-__-__"
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: formatPhoneNumber(e.target.value, newUser.phone) })}
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
            <Label>Email {isEmailChannel ? '' : '(опционально)'}</Label>
            <Input
              type="email"
              placeholder="ivan@company.ru"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            {newUser.email && !isValidEmail(newUser.email) && (
              <p className="text-xs text-destructive">Некорректный формат email</p>
            )}
            {isEmailChannel && !newUser.email && (
              <p className="text-xs text-muted-foreground">Укажите email для отправки приглашения</p>
            )}
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
            <div className="grid grid-cols-4 gap-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setNewUser({ ...newUser, messenger: channel.id })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    newUser.messenger === channel.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon
                    name={channel.icon as any}
                    size={20}
                    className={newUser.messenger === channel.id ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <span className="text-xs">{channel.label}</span>
                </button>
              ))}
            </div>
          </div>

          {inviteLink && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <Label className="text-xs">Ссылка-приглашение создана (действует 7 дней)</Label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={() => onCopyLink(inviteLink)}>
                  <Icon name="Copy" size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Приглашение отправлено через {channels.find(c => c.id === newUser.messenger)?.label}
              </p>
            </div>
          )}

          <Button
            onClick={onInvite}
            disabled={!canSubmit}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                Отправка...
              </>
            ) : inviteLink ? 'Отправить ещё одно приглашение' : 'Отправить приглашение'}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
