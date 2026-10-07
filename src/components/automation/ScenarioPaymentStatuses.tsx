import { Checkbox } from '@/components/ui/checkbox';
import { NOTIFY_KEY_STATUS, notifyOptionsFor } from '@/components/integrations/providerFieldsConfig';
import { IntegrationOption } from './automationConfig';

interface ScenarioPaymentStatusesProps {
  source: IntegrationOption;
  value: string[];
  onChange: (statuses: string[]) => void;
}

const ScenarioPaymentStatuses = ({ source, value, onChange }: ScenarioPaymentStatusesProps) => {
  const options = notifyOptionsFor(source.providerSlug);
  const settings = source.webhookSettings || {};
  const enabled = options.filter((o) => settings[o.key] !== false);
  const disabled = options.filter((o) => settings[o.key] === false);
  const selected = value.length ? value : ['CONFIRMED'];

  const toggle = (status: string, on: boolean) => {
    const next = on ? [...new Set([...selected, status])] : selected.filter((s) => s !== status);
    if (next.length) onChange(next);
  };

  return (
    <div className="space-y-2">
      {enabled.map((o) => {
        const status = NOTIFY_KEY_STATUS[o.key];
        return (
          <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(status)} onCheckedChange={(c) => toggle(status, !!c)} />
            {o.label}
          </label>
        );
      })}
      {!enabled.length && (
        <p className="text-xs text-destructive">Интеграция не принимает уведомления о статусах — сценарий не запустится</p>
      )}
      {disabled.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Не принимаются для этой интеграции: {disabled.map((o) => o.label).join(', ')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Для каждого статуса платежа — свой сценарий: например, «Оплачен» → чек прихода, «Возврат» → чек возврата прихода.
        В сверке все документы одного платежа собираются в одну группу по номеру транзакции
      </p>
    </div>
  );
};

export default ScenarioPaymentStatuses;
