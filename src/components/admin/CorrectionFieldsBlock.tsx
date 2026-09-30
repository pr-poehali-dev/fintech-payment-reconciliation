import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReceiptFieldSelect from './ReceiptFieldSelect';
import { ActionTemplateForm, DATE_SOURCE_OPTIONS, needsBaseNumber } from './actionTemplatesConfig';

interface CorrectionFieldsBlockProps {
  form: ActionTemplateForm;
  onChange: (form: ActionTemplateForm) => void;
}

const CorrectionFieldsBlock = ({ form, onChange }: CorrectionFieldsBlockProps) => {
  const v5 = form.protocol_version === 'v5';

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div>
        <div className="text-sm font-semibold">Основание коррекции</div>
        <div className="text-xs text-muted-foreground">Самостоятельная коррекция · {form.protocol_version}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReceiptFieldSelect
          label={v5 ? 'Дата корректируемого расчёта' : 'Дата документа основания'}
          value={form.correction_date_source}
          options={DATE_SOURCE_OPTIONS}
          onChange={(v) => onChange({ ...form, correction_date_source: v })}
        />
        {form.correction_date_source === 'fixed' && (
          <div className="space-y-2">
            <Label>Дата</Label>
            <Input
              type="date"
              value={form.correction_base_date}
              onChange={(e) => onChange({ ...form, correction_base_date: e.target.value })}
            />
          </div>
        )}
      </div>

      {needsBaseNumber(form) && (
        <div className="space-y-2">
          <Label>Номер документа основания</Label>
          <Input
            value={form.correction_base_number}
            maxLength={32}
            placeholder="1175"
            onChange={(e) => onChange({ ...form, correction_base_number: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Обязателен в протоколе v4</p>
        </div>
      )}
    </div>
  );
};

export default CorrectionFieldsBlock;
