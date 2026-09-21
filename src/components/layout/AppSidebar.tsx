import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, Company } from '@/contexts/AuthContext';
import { APP_MODULES } from '@/config/modules';

interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
}

const CompanySwitcher = ({ companies, currentCompany, onSelect }: {
  companies: Company[];
  currentCompany: Company | null;
  onSelect: (id: number) => void;
}) => {
  const navigate = useNavigate();

  if (companies.length === 0) return null;

  return (
    <div className="mb-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-sidebar-accent border border-sidebar-border hover:bg-sidebar-accent/70 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="Building2" size={16} className="text-sidebar-foreground/60 shrink-0" />
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {currentCompany?.name || 'Выберите компанию'}
              </span>
            </div>
            <Icon name="ChevronsUpDown" size={14} className="text-sidebar-foreground/40 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Ваши компании</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => onSelect(company.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{company.name}</span>
              {company.id === currentCompany?.id && (
                <Icon name="Check" size={14} className="text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/create-company')}>
            <Icon name="Plus" size={14} className="mr-2" />
            Добавить компанию
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const UserProfileMenu = () => {
  const { user, currentCompany, logout } = useAuth();

  return (
    <div className="absolute bottom-4 left-4 right-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full text-left">
            <Card className="bg-sidebar-accent border-sidebar-border hover:bg-sidebar-accent/70 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Icon name="User" size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user?.full_name || user?.phone || 'Пользователь'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {currentCompany?.role_name || 'Без роли'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{user?.phone}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
            <Icon name="LogOut" size={14} className="mr-2" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const AppSidebar = ({ activeModule, onModuleChange }: AppSidebarProps) => {
  const { companies, currentCompany, setCurrentCompanyId } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border p-4 animate-slide-in-right">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <Icon name="Zap" size={28} />
          Екомкасса ПРО
        </h1>
        <p className="text-sm text-sidebar-foreground/60 mt-1">Платформа сверки 54-ФЗ</p>
      </div>

      <CompanySwitcher
        companies={companies}
        currentCompany={currentCompany}
        onSelect={setCurrentCompanyId}
      />

      <nav className="space-y-2">
        {APP_MODULES.map((module) => (
          <button
            key={module.id}
            onClick={() => onModuleChange(module.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeModule === module.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg scale-105'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            }`}
          >
            <Icon name={module.icon as any} size={20} />
            <span className="font-medium">{module.name}</span>
          </button>
        ))}
      </nav>

      <UserProfileMenu />
    </aside>
  );
};

export default AppSidebar;
