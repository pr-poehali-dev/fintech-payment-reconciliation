import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidEmail } from '@/lib/formatters';
import functionUrls from '../../../backend/func2url.json';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatPhone = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 11) return phone;
  return `+${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
};

const ProfileDialog = ({ open, onOpenChange }: ProfileDialogProps) => {
  const { user, currentCompany, updateUser } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(user?.full_name || '');
      setEmail(user?.email || '');
    }
  }, [open, user]);

  const hasChanges = fullName.trim() !== (user?.full_name || '') || email.trim() !== (user?.email || '');
  const canSave = !!fullName.trim() && isValidEmail(email.trim()) && hasChanges && !isSaving;

  const handleSave = async () => {
    if (!user || !canSave) return;
    setIsSaving(true);
    try {
      const response = await fetch(functionUrls['profile-update'], {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, full_name: fullName.trim(), email: email.trim() })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        updateUser({ full_name: data.user.full_name, email: data.user.email });
        toast({ title: 'Профиль сохранён' });
        onOpenChange(false);
      } else {
        toast({ title: 'Не удалось сохранить', description: data.error || 'Попробуйте ещё раз', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', description: 'Проверьте интернет-соединение', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Профиль</DialogTitle>
          <DialogDescription>Ваши данные для работы в сервисе и приглашений в команды</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Номер телефона</Label>
            <Input value={user ? formatPhone(user.phone) : ''} disabled />
            <p className="text-xs text-muted-foreground">Используется для входа, изменить нельзя</p>
          </div>

          <div className="space-y-2">
            <Label>ФИО</Label>
            <Input placeholder="Иван Иванов" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Email (опционально)</Label>
            <Input
              type="email"
              placeholder="ivan@company.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email && !isValidEmail(email.trim()) && (
              <p className="text-xs text-destructive">Некорректный формат email</p>
            )}
          </div>

          {currentCompany && (
            <div className="space-y-2">
              <Label>Роль в компании «{currentCompany.name}»</Label>
              <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
                <div className={`h-3 w-3 rounded-full ${currentCompany.role_color || 'bg-primary'}`} />
                {currentCompany.role_name}
              </div>
            </div>
          )}
        </div>

        <Button className="w-full gap-2" onClick={handleSave} disabled={!canSave}>
          <Icon name={isSaving ? 'Loader2' : 'Check'} size={16} className={isSaving ? 'animate-spin' : ''} />
          Сохранить
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
