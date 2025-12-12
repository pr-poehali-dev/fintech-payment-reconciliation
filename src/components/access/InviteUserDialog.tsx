import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface Role {
  id: string;
  name: string;
  color: string;
  modules: string[];
  permissions: string[];
}

interface NewUser {
  phone: string;
  fullName: string;
  email: string;
  role: string;
  messenger: 'telegram' | 'whatsapp' | 'max';
}

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newUser: NewUser;
  setNewUser: (user: NewUser) => void;
  roles: Role[];
  inviteLink: string;
  isLoading: boolean;
  onInvite: () => void;
  onCopyLink: (text: string) => void;
}

const InviteUserDialog = ({ 
  open, 
  onOpenChange, 
  newUser, 
  setNewUser, 
  roles, 
  inviteLink, 
  isLoading, 
  onInvite,
  onCopyLink 
}: InviteUserDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <Button size="icon" variant="outline" onClick={() => onCopyLink(inviteLink)}>
                  <Icon name="Copy" size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Приглашение отправлено в {newUser.messenger}
              </p>
            </div>
          )}

          <Button 
            onClick={onInvite}
            disabled={!newUser.phone || !newUser.fullName || !newUser.role || isLoading}
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
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
