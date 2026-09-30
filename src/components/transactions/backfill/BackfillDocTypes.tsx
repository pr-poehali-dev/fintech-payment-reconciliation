import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { ActiveSources, DOC_TYPES, DocType, isDocTypeAvailable, sourcesHint } from './backfillSources';

interface BackfillDocTypesProps {
  selected: DocType[];
  sources: ActiveSources;
  disabled: boolean;
  onToggle: (type: DocType) => void;
}

const BackfillDocTypes = ({ selected, sources, disabled, onToggle }: BackfillDocTypesProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Документы</Label>
      <div className="grid grid-cols-2 gap-3">
        {DOC_TYPES.map((t) => {
          const available = isDocTypeAvailable(t.id, sources);
          return (
            <div key={t.id} className="flex items-start gap-2">
              <Checkbox
                id={`doc-${t.id}`}
                checked={available && selected.includes(t.id)}
                onCheckedChange={() => onToggle(t.id)}
                disabled={disabled || !available}
                className="mt-0.5"
              />
              <Label
                htmlFor={`doc-${t.id}`}
                className={`text-sm font-normal ${available ? 'cursor-pointer' : 'text-muted-foreground'}`}
              >
                <span className="flex items-center gap-1.5">
                  <Icon name={t.icon} size={13} />
                  {t.label}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">{sourcesHint(t.id, sources)}</span>
              </Label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon name="CheckCircle2" size={12} />
        Загружаются только документы в статусе «Завершено»
      </p>
    </div>
  );
};

export default BackfillDocTypes;
