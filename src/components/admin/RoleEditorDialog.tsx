import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { APP_MODULES } from '@/config/modules';

export interface RoleFormState {
  name: string;
  description: string;
  color: string;
  modules: string[];
  permissions: string[];
}

const COLOR_OPTIONS = [
  { value: 'bg-primary', label: 'Основной' },
  { value: 'bg-info', label: 'Синий' },
  { value: 'bg-success', label: 'Зелёный' },
  { value: 'bg-warning', label: 'Жёлтый' },
  { value: 'bg-destructive', label: 'Красный' }
];

const PERMISSION_OPTIONS = [
  { value: 'full_access', label: 'Полный доступ' },
  { value: 'view_all', label: 'Просмотр всего' },
  { value: 'edit_all', label: 'Редактирование всего' },
  { value: 'view_own', label: 'Просмотр своего' },
  { value: 'edit_own', label: 'Редактирование своего' },
  { value: 'edit_payments', label: 'Редактирование платежей' },
  { value: 'export_data', label: 'Экспорт данных' },
  { value: 'manage_users', label: 'Управление пользователями' },
  { value: 'manage_roles', label: 'Управление ролями' },
  { value: 'remove_data', label: 'Удаление данных' }
];

interface RoleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formState: RoleFormState;
  onChange: (state: RoleFormState) => void;
  onSubmit: () => void;
  isSaving: boolean;
  isEditing: boolean;
}

const RoleEditorDialog = ({ open, onOpenChange, formState, onChange, onSubmit, isSaving, isEditing }: RoleEditorDialogProps) => {
  const toggleModule = (moduleId: string) => {
    onChange({
      ...formState,
      modules: formState.modules.includes(moduleId)
        ? formState.modules.filter(m => m !== moduleId)
        : [...formState.modules, moduleId]
    });
  };

  const togglePermission = (perm: string) => {
    onChange({
      ...formState,
      permissions: formState.permissions.includes(perm)
        ? formState.permissions.filter(p => p !== perm)
        : [...formState.permissions, perm]
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редактировать роль' : 'Создать роль'}</DialogTitle>
          <DialogDescription>
            Настройте название, модули и права доступа
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Название роли</Label>
            <Input
              placeholder="Например: Менеджер по продажам"
              value={formState.name}
              onChange={(e) => onChange({ ...formState, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              placeholder="Краткое описание роли"
              value={formState.description}
              onChange={(e) => onChange({ ...formState, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Цвет</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onChange({ ...formState, color: opt.value })}
                  className={`w-8 h-8 rounded-full ${opt.value} transition-all ${
                    formState.color === opt.value ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''
                  }`}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Доступные модули</Label>
            <div className="grid grid-cols-2 gap-3">
              {APP_MODULES.map((module) => (
                <div key={module.id} className="flex items-center gap-2">
                  <Switch
                    checked={formState.modules.includes(module.id)}
                    onCheckedChange={() => toggleModule(module.id)}
                  />
                  <div className="flex items-center gap-2">
                    <Icon name={module.icon as any} size={16} />
                    <span className="text-sm">{module.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Права</Label>
            <div className="grid grid-cols-2 gap-3">
              {PERMISSION_OPTIONS.map((perm) => (
                <div key={perm.value} className="flex items-center gap-2">
                  <Switch
                    checked={formState.permissions.includes(perm.value)}
                    onCheckedChange={() => togglePermission(perm.value)}
                  />
                  <span className="text-sm">{perm.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={onSubmit}
            disabled={!formState.name.trim() || isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                Сохранение...
              </>
            ) : isEditing ? 'Сохранить изменения' : 'Создать роль'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleEditorDialog;
