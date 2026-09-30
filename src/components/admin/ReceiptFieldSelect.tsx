import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Option } from './actionTemplatesConfig';

interface ReceiptFieldSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const ReceiptFieldSelect = ({ label, value, options, onChange, placeholder }: ReceiptFieldSelectProps) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {o.hint && <span className="ml-1.5 font-mono text-xs text-muted-foreground">· {o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default ReceiptFieldSelect;
