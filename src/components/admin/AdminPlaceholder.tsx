import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface AdminPlaceholderProps {
  icon: string;
  title: string;
  description: string;
}

const AdminPlaceholder = ({ icon, title, description }: AdminPlaceholderProps) => (
  <div className="animate-fade-in">
    <div className="mb-8">
      <h2 className="text-3xl font-display font-bold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
    <Card className="border-border bg-card">
      <CardContent className="p-12 text-center">
        <Icon name={icon as any} size={64} className="mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-display font-bold mb-2">Раздел в разработке</h3>
        <p className="text-muted-foreground">Скоро здесь появится управление</p>
      </CardContent>
    </Card>
  </div>
);

export default AdminPlaceholder;
