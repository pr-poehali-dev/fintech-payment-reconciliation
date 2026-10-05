import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ReceiptFieldSelect from './ReceiptFieldSelect';
import { ActionTemplateForm, AGENT_TYPE_OPTIONS, AgentSettings, isBankAgent, isPayingAgent, maskPhones, PHONE_ERROR, phonesOk } from './actionTemplatesConfig';

interface AgentFieldsBlockProps {
  form: ActionTemplateForm;
  onChange: (form: ActionTemplateForm) => void;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  error?: string | null;
}

const Field = ({ label, value, onChange, placeholder, hint, maxLength, error }: FieldProps) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Input value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    {(error || hint) && <p className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || hint}</p>}
  </div>
);

const innError = (v: string) => (v && !/^(\d{10}|\d{12})$/.test(v) ? 'ИНН — 10 или 12 цифр' : null);
const PHONES_HINT = 'Формат +79999999999, несколько — через запятую';
const phoneError = (v: string) => (phonesOk(v) ? null : PHONE_ERROR);

const AgentFieldsBlock = ({ form, onChange }: AgentFieldsBlockProps) => {
  const a = form.agent_settings;
  const v5 = form.protocol_version === 'v5';
  const set = (key: keyof AgentSettings) => (value: string) =>
    onChange({ ...form, agent_settings: { ...a, [key]: key.endsWith('_inn') ? value.replace(/\D/g, '').slice(0, 12) : key.endsWith('_phones') ? maskPhones(value) : value } });

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div>
        <div className="text-sm font-semibold">Агентские данные</div>
        <div className="text-xs text-muted-foreground">
          {v5
            ? 'v5 (ФФД 1.2): признак агента и поставщик передаются в каждой товарной позиции'
            : 'v4 (ФФД 1.05): признак агента и телефоны поставщика — общие на весь чек, наименование и ИНН поставщика — в позициях'}
        </div>
      </div>

      <ReceiptFieldSelect label="Признак агента" value={a.agent_type} options={AGENT_TYPE_OPTIONS} onChange={set('agent_type')} />

      {isPayingAgent(a.agent_type) && (
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Платёжный агент</div>
          <Field label="Операция платёжного агента" value={a.paying_agent_operation} maxLength={24} placeholder="Оплата услуг" onChange={set('paying_agent_operation')} />
          <Field label="Телефоны платёжного агента" value={a.paying_agent_phones} placeholder="+79999999999" hint={PHONES_HINT} error={phoneError(a.paying_agent_phones)} onChange={set('paying_agent_phones')} />
          <Field label="Телефоны оператора по приёму платежей" value={a.receive_payments_operator_phones} placeholder="+79999999999" hint={PHONES_HINT} error={phoneError(a.receive_payments_operator_phones)} onChange={set('receive_payments_operator_phones')} />
        </div>
      )}

      {isBankAgent(a.agent_type) && (
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Оператор перевода</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Наименование" value={a.money_transfer_operator_name} maxLength={64} onChange={set('money_transfer_operator_name')} />
            <Field label="ИНН" value={a.money_transfer_operator_inn} error={innError(a.money_transfer_operator_inn)} onChange={set('money_transfer_operator_inn')} />
          </div>
          <Field label="Адрес" value={a.money_transfer_operator_address} maxLength={243} onChange={set('money_transfer_operator_address')} />
          <Field label="Телефоны" value={a.money_transfer_operator_phones} placeholder="+79999999999" hint={PHONES_HINT} error={phoneError(a.money_transfer_operator_phones)} onChange={set('money_transfer_operator_phones')} />
        </div>
      )}

      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Поставщик (принципал)</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Наименование"
            value={a.supplier_name}
            maxLength={239}
            placeholder="ООО «Поставщик»"
            hint="Пусто — клиент укажет в сценарии"
            onChange={set('supplier_name')}
          />
          <Field
            label="ИНН"
            value={a.supplier_inn}
            placeholder="7707083893"
            error={innError(a.supplier_inn)}
            hint="Пусто — клиент укажет в сценарии"
            onChange={set('supplier_inn')}
          />
        </div>
        <Field label="Телефоны поставщика" value={a.supplier_phones} placeholder="+79999999999" hint={PHONES_HINT} error={phoneError(a.supplier_phones)} onChange={set('supplier_phones')} />
      </div>
    </div>
  );
};

export default AgentFieldsBlock;
