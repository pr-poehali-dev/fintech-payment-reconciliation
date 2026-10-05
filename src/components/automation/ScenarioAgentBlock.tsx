import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AGENT_TYPE_OPTIONS, isBankAgent, isPayingAgent } from '@/components/admin/actionTemplatesConfig';
import { ActionTemplateOption } from './automationConfig';

type AgentValues = Record<string, string | string[]>;

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  phones?: boolean;
  inn?: boolean;
  required?: boolean;
  when?: (agentType: string) => boolean;
}

interface Group {
  title: string;
  fields: FieldDef[];
}

const asText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v || '');
const isEmpty = (v: string | string[] | undefined) => !asText(v).trim();

// Группы полей - как в шаблоне действия (АТОЛ Онлайн, агентский чек).
const groups = (): Group[] => [
  {
    title: 'Платёжный агент',
    fields: [
      { key: 'paying_agent_operation', label: 'Операция платёжного агента', placeholder: 'Оплата услуг', maxLength: 24, when: isPayingAgent },
      { key: 'paying_agent_phones', label: 'Телефоны платёжного агента', placeholder: '+79991234567', phones: true, when: isPayingAgent },
      { key: 'receive_payments_operator_phones', label: 'Телефоны оператора по приёму платежей', placeholder: '+79991234567', phones: true, when: isPayingAgent }
    ]
  },
  {
    title: 'Оператор перевода',
    fields: [
      { key: 'money_transfer_operator_name', label: 'Наименование', maxLength: 64, when: isBankAgent },
      { key: 'money_transfer_operator_inn', label: 'ИНН', inn: true, when: isBankAgent },
      { key: 'money_transfer_operator_address', label: 'Адрес', maxLength: 243, when: isBankAgent },
      { key: 'money_transfer_operator_phones', label: 'Телефоны', placeholder: '+79991234567', phones: true, when: isBankAgent }
    ]
  },
  {
    title: 'Поставщик (принципал)',
    fields: [
      { key: 'supplier_name', label: 'Наименование', placeholder: 'ООО «Авито»', maxLength: 239, required: true },
      { key: 'supplier_inn', label: 'ИНН', placeholder: '7710668349', inn: true, required: true },
      { key: 'supplier_phones', label: 'Телефоны поставщика', placeholder: '+79991234567', phones: true }
    ]
  }
];

const innError = (v: string) => (v && !/^(\d{10}|\d{12})$/.test(v) ? 'ИНН — 10 или 12 цифр' : null);
const phonesError = (v: string) =>
  v.split(',').every((p) => !p.trim() || /^\+?\d{10,19}$/.test(p.replace(/[\s()-]/g, ''))) ? null : 'Формат +79991234567, через запятую';

// Поля агентского чека, которые не заполнены в шаблоне: что спросить у клиента в сценарии.
export const agentAsk = (template: ActionTemplateOption | undefined) => {
  if (template?.receipt_type !== 'agent') return [];
  const base = template.agent_settings || {};
  const type = String(base.agent_type || '');
  return groups()
    .map((g) => ({ ...g, fields: g.fields.filter((f) => (!f.when || f.when(type)) && isEmpty(base[f.key])) }))
    .filter((g) => g.fields.length > 0);
};

// Незаполненные обязательные и ошибочные поля - для блокировки кнопки «Сохранить».
export const agentProblems = (template: ActionTemplateOption | undefined, values: AgentValues = {}, fromCrm: string[] = []) =>
  agentAsk(template).flatMap((g) => g.fields.flatMap((f) => {
    const v = asText(values[f.key]).trim();
    const name = `${g.title.toLowerCase()}: ${f.label.toLowerCase()}`;
    if (f.required && !v && !fromCrm.includes(f.key)) return [name];
    if ((f.inn && innError(v)) || (f.phones && phonesError(v))) return [name];
    return [];
  }));

interface ScenarioAgentBlockProps {
  template: ActionTemplateOption;
  values: AgentValues;
  onChange: (values: AgentValues) => void;
  fromCrm?: string[];
}

const ScenarioAgentBlock = ({ template, values, onChange, fromCrm = [] }: ScenarioAgentBlockProps) => {
  const v5 = template.protocol_version === 'v5';
  const base = template.agent_settings || {};
  const typeLabel = AGENT_TYPE_OPTIONS.find((o) => o.value === base.agent_type)?.label || String(base.agent_type || '—');
  const ask = agentAsk(template);
  const set = (f: FieldDef, raw: string) =>
    onChange({ ...values, [f.key]: f.inn ? raw.replace(/\D/g, '').slice(0, 12) : raw });

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="text-xs text-muted-foreground">
        Признак агента — {typeLabel} · протокол {v5 ? 'v5 (ФФД 1.2): признак агента и поставщик передаются в каждой позиции чека' : 'v4 (ФФД 1.05): признак агента и телефоны поставщика — на весь чек, наименование и ИНН поставщика — в позициях'}
      </p>
      {ask.length === 0 && <p className="text-xs text-muted-foreground">Все агентские поля заданы в шаблоне — заполнять ничего не нужно</p>}
      {ask.map((g) => (
        <div key={g.title} className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.fields.map((f) => {
              const v = asText(values[f.key]);
              const error = (f.inn && innError(v)) || (f.phones && phonesError(v)) || null;
              const crm = fromCrm.includes(f.key);
              return (
                <div key={f.key} className={`space-y-1 ${f.phones || f.key.endsWith('address') ? 'sm:col-span-2' : ''}`}>
                  <Label className="text-xs">
                    {f.label}
                    {crm ? (
                      <span className="text-primary"> · из CRM</span>
                    ) : f.required ? (
                      <span className="text-destructive"> *</span>
                    ) : (
                      <span className="text-muted-foreground"> (необязательно)</span>
                    )}
                  </Label>
                  <Input
                    value={v}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    inputMode={f.inn ? 'numeric' : undefined}
                    onChange={(e) => set(f, e.target.value)}
                  />
                  {error ? (
                    <p className="text-xs text-destructive">{error}</p>
                  ) : crm ? (
                    <p className="text-xs text-muted-foreground">Берём из сделки. Здесь — запасное значение, если поле в сделке пустое</p>
                  ) : f.phones ? (
                    <p className="text-xs text-muted-foreground">Несколько — через запятую</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScenarioAgentBlock;