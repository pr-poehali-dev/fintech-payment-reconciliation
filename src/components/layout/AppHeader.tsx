import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';

interface AppHeaderProps {
  title: string;
  unreadCount: number;
  onShowNotifications: () => void;
}

const AppHeader = ({ title, unreadCount, onShowNotifications }: AppHeaderProps) => {
  const { logout } = useAuth();

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-background/95 backdrop-blur-sm border-b border-border z-40 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2">
          <Icon name="Download" size={16} />
          Экспорт
        </Button>

        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={onShowNotifications}
            className="relative"
          >
            <Icon name="Bell" size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-scale-in">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>

        <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={logout}>
          <Icon name="LogOut" size={16} />
          Выход
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
