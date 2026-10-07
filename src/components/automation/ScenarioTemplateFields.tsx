import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEMPLATE_VAT_OPTIONS, VAT_IN_SCENARIO } from '@/components/admin/actionTemplatesConfig';
import { ActionTemplate, ActionTemplateOption, CorrectionSettings } from './automationConfig';

interface ScenarioTemplateFieldsProps {
  actionTemplate: ActionTemplate;
  onTemplateChange: (value: ActionTemplate) => void;
  templates: ActionTemplateOption[];
  currentTemplate: ActionTemplateOption | undefined;
  cs: CorrectionSettings;
  setCs: (patch: CorrectionSettings) => void;
  askEmail: boolean;
  emailInvalid: boolean;
  askVat: boolean;
  askCashier: boolean;
  isCorrection: boolean;
}

const ScenarioTemplateFields = ({
  actionTemplate,
  onTemplateChange,
  templates,
  currentTemplate,
  cs,
  setCs,
  askEmail,
  emailInvalid,
  askVat,
  askCashier,
  isCorrection
}: ScenarioTemplateFieldsProps) => (
  <>
    <Select value={actionTemplate} onValueChange={(v) => onTemplateChange(v as ActionTemplate)}>
      <SelectTrigger>
        <SelectValue placeholder={templates.length ? 'Выберите шаблон' : 'Нет доступных шаблонов'} />
      </SelectTrigger>
      <SelectContent>
        {templates.map((t) => (
          <SelectItem key={t.code} value={t.code}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {currentTemplate?.description && <p className="text-xs text-muted-foreground">{currentTemplate.description}</p>}
    {askEmail && (
      <div className="space-y-1 pt-2">
        <Label>Почта по умолчанию</Label>
        <Input
          type="email"
          placeholder="receipts@company.ru"
          value={cs.default_email || ''}
          onChange={(e) => setCs({ default_email: e.target.value })}
        />
        <p className={`text-xs ${emailInvalid ? 'text-destructive' : 'text-muted-foreground'}`}>
          {emailInvalid
            ? 'Проверьте адрес почты'
            : isCorrection
              ? 'Подставится в чек как почта компании и покупателя, если их нет'
              : 'Подставится в чек, если у покупателя нет почты или телефона'}
        </p>
      </div>
    )}
    {askVat && (
      <div className="space-y-1 pt-2">
        <Label>НДС, если в платеже нет товаров</Label>
        <Select value={cs.vat || 'none'} onValueChange={(v) => setCs({ vat: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_VAT_OPTIONS.filter((o) => o.value !== VAT_IN_SCENARIO).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Чек пробьётся одной позицией на сумму платежа с этой ставкой. Если товары есть — ставка берётся из них
        </p>
      </div>
    )}
    {askCashier && (
      <div className="space-y-1 pt-2">
        <Label>Кассир в чеке (необязательно)</Label>
        <Input
          placeholder="Например, Иванов Иван"
          maxLength={100}
          value={cs.cashier_name || ''}
          onChange={(e) => setCs({ cashier_name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Если пусто — касса подставит кассира магазина</p>
      </div>
    )}
  </>
);

export default ScenarioTemplateFields;
