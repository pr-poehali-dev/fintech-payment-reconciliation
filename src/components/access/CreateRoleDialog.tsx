import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Module {
  id: string;
  name: string;
  icon: string;
}

interface NewRole {
  name: string;
  color: string;
  modules: string[];
  permissions: string[];
}

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRole: NewRole;
  setNewRole: (role: NewRole) => void;
  modules: Module[];
}

const CreateRoleDialog = ({ open, onOpenChange, newRole, setNewRole, modules }: CreateRoleDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onOpenChange(false);
              setNewRole({ name: '', color: 'bg-blue-500', modules: [], permissions: [] });
            }}
            className="w-full"
          >
            Создать роль
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoleDialog;
