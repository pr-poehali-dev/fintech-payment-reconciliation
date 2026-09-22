import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Category, Provider } from './providerFieldsConfig';

interface IntegrationProviderStepProps {
  selectedCategory: Category;
  connectedProviderIds: number[];
  onSelectProvider: (provider: Provider) => void;
  onBack: () => void;
}

const IntegrationProviderStep = ({
  selectedCategory,
  connectedProviderIds,
  onSelectProvider,
  onBack
}: IntegrationProviderStepProps) => {
  return (
    <div className="space-y-3">
      {selectedCategory.providers.map((prov) => {
        const isConnected = connectedProviderIds.includes(prov.id);
        return (
          <button
            key={prov.id}
            onClick={() => onSelectProvider(prov)}
            className="w-full flex items-center justify-between gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors text-left"
          >
            <div className="min-w-0">
              <div className="font-semibold">{prov.name}</div>
              <div className="text-xs text-muted-foreground truncate">{prov.description}</div>
            </div>
            {isConnected && (
              <Badge variant="outline" className="shrink-0">
                Уже подключено
              </Badge>
            )}
          </button>
        );
      })}

      <div className="flex justify-start pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="ArrowLeft" size={14} className="mr-2" />
          К категориям
        </Button>
      </div>
    </div>
  );
};

export default IntegrationProviderStep;
