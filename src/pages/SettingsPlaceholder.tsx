import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

const SettingsPlaceholder = () => (
  <div className="animate-fade-in">
    <div className="mb-8">
      <h2 className="text-3xl font-display font-bold text-foreground mb-2">Настройки</h2>
      <p className="text-muted-foreground">Конфигурация системы и параметры</p>
    </div>
    <Card className="border-border bg-card">
      <CardContent className="p-12 text-center">
        <Icon name="Settings" size={64} className="mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-display font-bold mb-2">Модуль настроек</h3>
        <p className="text-muted-foreground">Здесь будут параметры системы</p>
      </CardContent>
    </Card>
  </div>
);

export default SettingsPlaceholder;
