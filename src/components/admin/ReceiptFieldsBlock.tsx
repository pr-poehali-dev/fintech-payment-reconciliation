import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReceiptFieldSelect from './ReceiptFieldSelect';
import {
  ActionTemplateForm,
  CashProvider,
  MEASURE_OPTIONS,
  OPERATION_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_OBJECT_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  PROTOCOL_OPTIONS,
  RECEIPT_TYPE_OPTIONS
} from './actionTemplatesConfig';

interface ReceiptFieldsBlockProps {
  form: ActionTemplateForm;
  providers: CashProvider[];
  onChange: (form: ActionTemplateForm) => void;
}

const ReceiptFieldsBlock = ({ form, providers, onChange }: ReceiptFieldsBlockProps) => {
  const set = (field: keyof ActionTemplateForm) => (value: string) => onChange({ ...form, [field]: value });
  const emailInvalid = !!form.default_email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.default_email.trim());
  const refundCorrectionV4 = form.receipt_type === 'correction' && form.operation === 'sell_refund' && form.protocol_version === 'v4';

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="text-sm font-semibold">Параметры чека</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <ReceiptFieldSelect
          label="Касса"
          value={form.provider_id ? String(form.provider_id) : ''}
          placeholder="Выберите кассу"
          options={providers.map((p) => ({ value: String(p.id), label: p.name }))}
          onChange={(v) => onChange({ ...form, provider_id: Number(v) })}
        />
        <ReceiptFieldSelect label="Версия протокола" value={form.protocol_version} options={PROTOCOL_OPTIONS} onChange={set('protocol_version')} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReceiptFieldSelect label="Тип чека" value={form.receipt_type} options={RECEIPT_TYPE_OPTIONS} onChange={set('receipt_type')} />
        <ReceiptFieldSelect label="Тип операции" value={form.operation} options={OPERATION_OPTIONS} onChange={set('operation')} />
      </div>
      {refundCorrectionV4 && (
        <p className="text-xs text-destructive">Коррекция возврата прихода есть только в протоколе v5</p>
      )}

      <ReceiptFieldSelect label="Признак расчёта" value={form.payment_method} options={PAYMENT_METHOD_OPTIONS} onChange={set('payment_method')} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReceiptFieldSelect label="Предмет расчёта" value={form.payment_object} options={PAYMENT_OBJECT_OPTIONS} onChange={set('payment_object')} />
        <ReceiptFieldSelect label="Измерения" value={form.measure} options={MEASURE_OPTIONS} onChange={set('measure')} />
      </div>

      <ReceiptFieldSelect label="Тип оплаты" value={form.payment_type} options={PAYMENT_TYPE_OPTIONS} onChange={set('payment_type')} />

      <div className="space-y-2">
        <Label>Почта по умолчанию</Label>
        <Input
          type="email"
          value={form.default_email}
          placeholder="receipts@company.ru"
          onChange={(e) => onChange({ ...form, default_email: e.target.value })}
        />
        <p className={`text-xs ${emailInvalid ? 'text-destructive' : 'text-muted-foreground'}`}>
          {emailInvalid ? 'Проверьте адрес почты' : 'Подставляется в чек, если у покупателя нет почты'}
        </p>
      </div>
    </div>
  );
};

export default ReceiptFieldsBlock;
