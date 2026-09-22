import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Category } from './providerFieldsConfig';

interface IntegrationCategoryStepProps {
  categories: Category[];
  onSelectCategory: (category: Category) => void;
}

const IntegrationCategoryStep = ({ categories, onSelectCategory }: IntegrationCategoryStepProps) => {
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelectCategory(category)}
          disabled={category.providers.length === 0}
          className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name={category.icon as any} size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{category.name}</div>
            <div className="text-xs text-muted-foreground truncate">{category.description}</div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {category.providers.length} шт.
          </Badge>
        </button>
      ))}
    </div>
  );
};

export default IntegrationCategoryStep;
