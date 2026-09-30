import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReceiptFieldSelect from './ReceiptFieldSelect';
import { ActionTemplateForm, CORRECTION_TYPE_OPTIONS, DATE_SOURCE_OPTIONS, needsBaseNumber } from './actionTemplatesConfig';

interface CorrectionFieldsBlockProps {
  form: ActionTemplateForm;
  onChange: (form: ActionTemplateForm) => void;
}

const CorrectionFieldsBlock = ({ form, onChange }: CorrectionFieldsBlockProps) => {
  const v5 = form.protocol_version === 'v5';
  const numberRequired = needsBaseNumber(form);
  const dateLabel = v5 ? 'Дата корректируемого расчёта' : 'Дата документа основания';

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="text-sm font-semibold">
        Основание коррекции <span className="font-mono text-xs font-normal text-muted-foreground">correction_info · {form.protocol_version}</span>
      </div>

      <ReceiptFieldSelect
        label="Тип коррекции"
        value={form.correction_type}
        options={CORRECTION_TYPE_OPTIONS}
        onChange={(v) => onChange({ ...form, correction_type: v })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReceiptFieldSelect
          label={dateLabel}
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

      {numberRequired ? (
        <div className="space-y-2">
          <Label>Номер документа основания</Label>
          <Input
            value={form.correction_base_number}
            maxLength={32}
            placeholder={v5 ? 'Номер предписания ФНС' : '1175'}
            onChange={(e) => onChange({ ...form, correction_base_number: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {v5 ? 'Для v5 — номер предписания налоговой, до 32 символов' : 'Для v4 обязателен при любом типе коррекции'}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">В v5 при самостоятельной коррекции номер документа не передаётся</p>
      )}
    </div>
  );
};

export default CorrectionFieldsBlock;
