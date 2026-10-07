import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IntegrationOption } from './automationConfig';

interface ScenarioTargetSelectProps {
  value: number | null;
  onChange: (id: number) => void;
  targetOptions: IntegrationOption[];
}

const ScenarioTargetSelect = ({ value, onChange, targetOptions }: ScenarioTargetSelectProps) => (
  <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
    <SelectTrigger>
      <SelectValue placeholder={targetOptions.length ? 'Где создать документ' : 'Сначала подключите кассу'} />
    </SelectTrigger>
    <SelectContent>
      {targetOptions.map((i) => (
        <SelectItem key={i.id} value={String(i.id)}>
          {i.name} · <span className="text-muted-foreground">{i.providerName}</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default ScenarioTargetSelect;
