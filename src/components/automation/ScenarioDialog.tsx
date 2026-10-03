import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import CrmMappingBlock from './CrmMappingBlock';
import {
  ACTIONS,
  ActionTemplate,
  ActionTemplateOption,
  ActionType,
  CorrectionSettings,
  DEFAULT_CRM_MAPPING,
  DEFAULT_DISCREPANCY_DELAY,
  DISCREPANCY_DELAY_OPTIONS,
  IntegrationOption,
  MAPPING_FIELDS,
  Scenario,
  TARGET_CATEGORIES,
  TRIGGERS,
  TriggerType
} from './automationConfig';

export interface ScenarioForm {
  name: string;
  trigger_type: TriggerType;
  source_integration_id: number | null;
  action_type: ActionType;
  action_template: ActionTemplate;
  target_integration_id: number | null;
  field_mapping: Record<string, unknown>;
  correction_settings: CorrectionSettings;
}

interface ScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: Scenario | null;
  prefill?: Partial<ScenarioForm> | null;
  integrations: IntegrationOption[];
  templates: ActionTemplateOption[];
  isSaving: boolean;
  onSave: (form: ScenarioForm) => void;
}

const emptyForm: ScenarioForm = {
  name: '',
  trigger_type: 'new_payment',
  source_integration_id: null,
  action_type: 'create_receipt',
  action_template: 'regular',
  target_integration_id: null,
  field_mapping: {},
  correction_settings: {}
};

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{n}</span>
      {title}
    </Label>
    {children}
  </div>
);

const ScenarioDialog = ({ open, onOpenChange, scenario, prefill, integrations, templates: allTemplates, isSaving, onSave }: ScenarioDialogProps) => {
  const [form, setForm] = useState<ScenarioForm>(emptyForm);
  const { currentCompany } = useAuth();

  useEffect(() => {
    if (!open) return;
    setForm(
      scenario
        ? {
            name: scenario.name,
            trigger_type: scenario.trigger_type,
            source_integration_id: scenario.source_integration_id,
            action_type: scenario.action_type,
            action_template: scenario.action_template,
            target_integration_id: scenario.target_integration_id,
            field_mapping: scenario.field_mapping || {},
            correction_settings: scenario.correction_settings || {}
          }
        : {
            ...emptyForm,
            action_template: allTemplates.find((t) => t.action_type === emptyForm.action_type)?.code || '',
            ...(prefill || {})
          }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scenario]);

  const trigger = TRIGGERS[form.trigger_type];
  const sourceOptions = trigger.sourceCategories
    ? integrations.filter((i) => trigger.sourceCategories?.includes(i.category))
    : [];
  const targetOptions = integrations.filter((i) => TARGET_CATEGORIES.includes(i.category));
  const templates = allTemplates.filter((t) => t.action_type === form.action_type);
  // Выключенный в админке шаблон остаётся видимым у сценария, который уже на нём настроен.
  if (scenario && form.action_template && !templates.some((t) => t.code === form.action_template) && scenario.action_type === form.action_type) {
    templates.push({ code: form.action_template, name: scenario.action_template_name || form.action_template, action_type: form.action_type, description: null });
  }
  const currentTemplate = templates.find((t) => t.code === form.action_template);
  const isCorrection = form.action_type === 'create_receipt' && currentTemplate?.receipt_type === 'correction';
  const isV5 = currentTemplate?.protocol_version === 'v5';
  const cs = form.correction_settings || {};
  const setCs = (patch: CorrectionSettings) => setForm({ ...form, correction_settings: { ...cs, ...patch } });
  const correctionMissing = isCorrection
    ? [
        isV5 && !cs.payment_address?.trim() && 'место расчётов',
        !isV5 && !(cs.correction_base_number?.trim() || currentTemplate?.correction_base_number) && 'номер основания',
        !isV5 && !cs.correction_base_name?.trim() && 'описание коррекции'
      ].filter(Boolean)
    : [];
  let step = 1;

  const sourceIntegration = integrations.find((i) => i.id === form.source_integration_id);
  const isBitrix = sourceIntegration?.providerSlug === 'bitrix24';
  const missingMapping = trigger.needsMapping
    ? MAPPING_FIELDS.filter((f) => f.required && !String(form.field_mapping[f.key] || '').trim())
    : [];
  const fixedItems = (form.field_mapping.fixed_items as { name: string; price: string }[] | undefined) || [];
  const itemsInvalid =
    trigger.needsMapping &&
    form.field_mapping.items_mode === 'fixed' &&
    !fixedItems.some((i) => i.name?.trim() && Number(String(i.price).replace(',', '.')) > 0);
  const canSave =
    !!form.name.trim() &&
    (!trigger.sourceCategories || !!form.source_integration_id) &&
    !!form.target_integration_id &&
    !!currentTemplate &&
    missingMapping.length === 0 &&
    correctionMissing.length === 0 &&
    !itemsInvalid &&
    !isSaving;

  const setTrigger = (value: TriggerType) => {
    const allowed = TRIGGERS[value].actions;
    const actionType = allowed && !allowed.includes(form.action_type) ? allowed[0] : form.action_type;
    setForm({
      ...form,
      trigger_type: value,
      source_integration_id: null,
      action_type: actionType,
      action_template:
        actionType === form.action_type
          ? form.action_template
          : allTemplates.find((t) => t.action_type === actionType)?.code || '',
      field_mapping:
        value === 'discrepancy'
          ? { delay_minutes: Number(form.field_mapping.delay_minutes) || DEFAULT_DISCREPANCY_DELAY }
          : form.trigger_type === 'discrepancy'
            ? {}
            : form.field_mapping
    });
  };
  const actionKeys = (trigger.actions || (Object.keys(ACTIONS) as ActionType[]));
  const delayMinutes = Number(form.field_mapping.delay_minutes) || DEFAULT_DISCREPANCY_DELAY;
  const setAction = (value: ActionType) =>
    setForm({ ...form, action_type: value, action_template: allTemplates.find((t) => t.action_type === value)?.code || '' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{scenario ? 'Сценарий' : 'Новый сценарий'}</DialogTitle>
          <DialogDescription>Что должно произойти — и какой документ создать в кассе</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input
              placeholder="Чек на каждую оплату СБП"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <Step n={step++} title="Источник">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TRIGGERS) as TriggerType[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrigger(key)}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all ${
                    form.trigger_type === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon name={TRIGGERS[key].icon} size={20} className={form.trigger_type === key ? 'text-primary' : 'text-muted-foreground'} />
                  <span className="text-xs font-medium">{TRIGGERS[key].label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{trigger.description}</p>
          </Step>

          {trigger.sourceCategories && (
            <Step n={step++} title="Интеграция-источник">
              <Select
                value={form.source_integration_id ? String(form.source_integration_id) : ''}
                onValueChange={(v) => {
                  const picked = integrations.find((i) => i.id === Number(v));
                  const crmDefaults = trigger.needsMapping && picked?.providerSlug === 'bitrix24' && !form.field_mapping.items_mode;
                  setForm({
                    ...form,
                    source_integration_id: Number(v),
                    field_mapping: crmDefaults ? { ...DEFAULT_CRM_MAPPING } : form.field_mapping
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
            </Step>
          )}

          {form.trigger_type === 'discrepancy' && (
            <Step n={step++} title="Когда считать, что чека нет">
              <Select
                value={String(delayMinutes)}
                onValueChange={(v) => setForm({ ...form, field_mapping: { ...form.field_mapping, delay_minutes: Number(v) } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISCREPANCY_DELAY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      Через {o.label} после оплаты
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Проверяются оплаченные платежи всех платёжек компании. Если за это время не пришёл ни чек кассы, ни чек ОФД —
                пробиваем чек по корзине платежа. Нет корзины — чек не пробиваем, задание останавливается с ошибкой.
              </p>
            </Step>
          )}

          <Step n={step++} title="Действие">
            <div className={`grid gap-2 ${actionKeys.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {actionKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAction(key)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    form.action_type === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon name={ACTIONS[key].icon} size={18} className={form.action_type === key ? 'text-primary' : 'text-muted-foreground'} />
                  {ACTIONS[key].label}
                </button>
              ))}
            </div>
          </Step>

          <Step n={step++} title="Шаблон действия">
            <Select value={form.action_template} onValueChange={(v) => setForm({ ...form, action_template: v as ActionTemplate })}>
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
          </Step>

          {isCorrection && (
            <Step n={step++} title="Чек коррекции">
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground">
                  Самостоятельная коррекция · протокол {isV5 ? 'v5 (ФФД 1.2)' : 'v4 (ФФД 1.05)'}. Дата основания — дата платежа.
                </p>
                {isV5 && (
                  <div className="space-y-1">
                    <Label>Место расчётов</Label>
                    <Input
                      placeholder="https://shop.ru или адрес магазина"
                      value={cs.payment_address || ''}
                      onChange={(e) => setCs({ payment_address: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Сайт для интернет-продаж или адрес точки — как в регистрации кассы</p>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Номер документа-основания{isV5 ? ' (необязательно)' : ''}</Label>
                  <Input
                    placeholder={currentTemplate?.correction_base_number || 'Например, 1 или номер акта'}
                    value={cs.correction_base_number || ''}
                    onChange={(e) => setCs({ correction_base_number: e.target.value })}
                  />
                </div>
                {!isV5 && (
                  <div className="space-y-1">
                    <Label>Описание коррекции</Label>
                    <Input
                      placeholder="Не пробит чек при оплате"
                      value={cs.correction_base_name || ''}
                      onChange={(e) => setCs({ correction_base_name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Причина коррекции — попадёт в чек</p>
                  </div>
                )}
                {correctionMissing.length > 0 && (
                  <p className="text-xs text-destructive">Заполните: {correctionMissing.join(', ')}</p>
                )}
              </div>
            </Step>
          )}

          <Step n={step++} title="Касса">
            <Select
              value={form.target_integration_id ? String(form.target_integration_id) : ''}
              onValueChange={(v) => setForm({ ...form, target_integration_id: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder={targetOptions.length ? 'Где создать документ' : 'Сначала подключите кассу'} />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.name} · <span className="text-muted-foreground">{i.providerName}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Step>

          {trigger.needsMapping && (
            <Step n={step++} title="Сопоставление полей">
              {!form.source_integration_id ? (
                <p className="text-xs text-muted-foreground">Выберите интеграцию-источник — подгрузим её поля</p>
              ) : isBitrix && currentCompany ? (
                <>
                  <p className="text-xs text-muted-foreground">Поля загружены из вашего Битрикс24, включая пользовательские</p>
                  <CrmMappingBlock
                    companyId={currentCompany.id}
                    integrationId={form.source_integration_id}
                    mapping={form.field_mapping}
                    onChange={(m) => setForm({ ...form, field_mapping: m })}
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Загрузка полей пока доступна только для Битрикс24</p>
              )}
            </Step>
          )}
        </div>

        <Button className="w-full gap-2" disabled={!canSave} onClick={() => onSave(form)}>
          <Icon name={isSaving ? 'Loader2' : 'Check'} size={16} className={isSaving ? 'animate-spin' : ''} />
          {scenario ? 'Сохранить' : 'Создать сценарий'}
        </Button>
        {!scenario && <p className="text-center text-xs text-muted-foreground">Сценарий создаётся остановленным — запустите его, когда будете готовы</p>}
      </DialogContent>
    </Dialog>
  );
};

export default ScenarioDialog;
