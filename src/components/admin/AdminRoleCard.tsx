import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { APP_MODULES } from '@/config/modules';

export interface AdminRole {
  id: number;
  slug: string;
  name: string;
  description: string;
  color: string;
  modules: string[];
  permissions: string[];
  is_system: boolean;
  users_count: number;
}

interface AdminRoleCardProps {
  role: AdminRole;
  onEdit: () => void;
  onDelete: () => void;
}

const AdminRoleCard = ({ role, onEdit, onDelete }: AdminRoleCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className={`w-3 h-3 rounded-full ${role.color}`} />
          <div className="flex items-center gap-2">
            {role.is_system && (
              <Badge variant="outline" className="text-xs">Системная</Badge>
            )}
            <Badge variant="secondary">{role.users_count}</Badge>
          </div>
        </div>
        <CardTitle className="text-lg">{role.name}</CardTitle>
        {role.description && (
          <p className="text-xs text-muted-foreground">{role.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              {role.modules.length} модулей
            </div>
            <div className="flex flex-wrap gap-1">
              {role.modules.slice(0, 3).map((moduleId) => {
                const module = APP_MODULES.find(m => m.id === moduleId);
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

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onEdit}>
              <Icon name="Pencil" size={14} />
              Изменить
            </Button>
            {!role.is_system && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={role.users_count > 0}
                title={role.users_count > 0 ? 'Роль назначена пользователям' : 'Удалить роль'}
              >
                <Icon name="Trash2" size={14} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminRoleCard;
