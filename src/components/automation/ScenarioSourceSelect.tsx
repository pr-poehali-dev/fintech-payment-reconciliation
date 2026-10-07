import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_CRM_MAPPING, IntegrationOption, TRIGGERS } from './automationConfig';
import type { ScenarioForm } from './ScenarioDialog';

interface ScenarioSourceSelectProps {
  form: ScenarioForm;
  setForm: (form: ScenarioForm) => void;
  integrations: IntegrationOption[];
  sourceOptions: IntegrationOption[];
  sourceIntegration: IntegrationOption | undefined;
  trigger: (typeof TRIGGERS)[keyof typeof TRIGGERS];
  sourceDefaults: (slug?: string, stage?: string) => Record<string, unknown>;
}

const ScenarioSourceSelect = ({
  form,
  setForm,
  integrations,
  sourceOptions,
  sourceIntegration,
  trigger,
  sourceDefaults
}: ScenarioSourceSelectProps) => (
  <Select
    value={form.source_integration_id ? String(form.source_integration_id) : ''}
    onValueChange={(v) => {
      const picked = integrations.find((i) => i.id === Number(v));
      const pickedProvider = picked?.providerSlug;
      const prevProvider = sourceIntegration?.providerSlug;
      const crmDefaults = trigger.needsMapping && (pickedProvider === 'bitrix24' || pickedProvider === 'amocrm')
        && (!form.field_mapping.items_mode || (prevProvider !== pickedProvider && !!prevProvider));
      const pickedCrm = picked?.providerSlug === 'moyklass' || picked?.providerSlug === 'realtycalendar';
      const prefix = picked?.providerSlug === 'realtycalendar' ? 'booking.' : 'payment.';
      const mkDefaults = pickedCrm && !String(form.field_mapping.order_id || '').startsWith(prefix);
      setForm({
        ...form,
        source_integration_id: Number(v),
        field_mapping: crmDefaults
          ? { ...DEFAULT_CRM_MAPPING }
          : mkDefaults
            ? sourceDefaults(picked?.providerSlug, picked?.stage)
            : !pickedCrm && trigger.sourceCategories?.includes('payments') && !trigger.needsMapping
              ? {}
              : form.field_mapping
      });
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder={sourceOptions.length ? 'Выберите интеграцию' : 'Нет подходящих интеграций'} />
    </SelectTrigger>
    <SelectContent>
      {sourceOptions.map((i) => (
        <SelectItem key={i.id} value={String(i.id)}>
          {i.name} · <span className="text-muted-foreground">{i.providerName}</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default ScenarioSourceSelect;
