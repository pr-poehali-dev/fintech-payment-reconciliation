import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ActionTemplateForm, NO_PAYMENT } from './actionTemplatesConfig';

interface DeliveryFieldsBlockProps {
  form: ActionTemplateForm;
  onChange: (form: ActionTemplateForm) => void;
}

const DeliveryFieldsBlock = ({ form, onChange }: DeliveryFieldsBlockProps) => {
  const unpaid = form.payment_type === NO_PAYMENT;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Сразу подтверждать доставку</div>
          <div className="text-xs text-muted-foreground">
            {unpaid
              ? 'Доступно только для оплаченного заказа — выберите тип оплаты'
              : 'Заказ закрывается без курьера, касса сразу пробивает чек'}
          </div>
        </div>
        <Switch
          checked={form.auto_deliver && !unpaid}
          disabled={unpaid}
          onCheckedChange={(v) => onChange({ ...form, auto_deliver: v })}
        />
      </label>

      {form.auto_deliver && !unpaid && (
        <div className="space-y-2">
          <Label>Кассир в чеке</Label>
          <Input
            value={form.cashier_name}
            maxLength={100}
            placeholder="Например, Иванов Иван"
            onChange={(e) => onChange({ ...form, cashier_name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Если пусто — касса подставит кассира магазина</p>
        </div>
      )}
    </div>
  );
};

export default DeliveryFieldsBlock;
