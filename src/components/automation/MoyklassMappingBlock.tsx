import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import functionUrls from '../../../backend/func2url.json';
import CrmFieldPicker from './CrmFieldPicker';
import CrmTemplateInput from './CrmTemplateInput';
import { CrmMeta, FixedItem, ItemsMode, MAPPING_FIELDS, MOYKLASS_ENTITIES, MOYKLASS_ITEMS_MODES, VAT_OPTIONS } from './automationConfig';

interface MoyklassMappingBlockProps {
  companyId: number;
  integrationId: number;
  offset: boolean;
  mapping: Record<string, unknown>;
  onChange: (mapping: Record<string, unknown>) => void;
  templatePaymentMethod?: string;
}

interface TestResult {
  success: boolean;
  error?: string | null;
  title?: string;
  stage_matches?: boolean;
  stage_note?: string;
  values?: Record<string, string | null>;
  items?: { name: string; price: number; quantity: number; sum: number; payment_method?: string }[];
  total?: number;
  note?: string | null;
  name_limit?: number;
  full_names?: string[];
}

const api = (functionUrls as Record<string, string>)['crm-fields'];
const metaCache: Record<number, CrmMeta> = {};

const METHOD_LABELS: Record<string, string> = {
  full_prepayment: 'предоплата 100%',
  prepayment: 'частичная предоплата',
  advance: 'аванс',
  full_payment: 'полный расчёт',
  partial_payment: 'частичный расчёт'
};

const MoyklassMappingBlock = ({ companyId, integrationId, offset, mapping, onChange, templatePaymentMethod }: MoyklassMappingBlockProps) => {
  const [meta, setMeta] = useState<CrmMeta | null>(metaCache[integrationId] || null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testId, setTestId] = useState('');
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  const itemsMode = (mapping.items_mode as ItemsMode) || 'single';
  const fixedItems = (mapping.fixed_items as FixedItem[]) || [];
  const set = (patch: Record<string, unknown>) => onChange({ ...mapping, ...patch });
  const setFixed = (index: number, patch: Partial<FixedItem>) =>
    set({ fixed_items: fixedItems.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  const load = async (force = false) => {
    if (!force && metaCache[integrationId]) {
      setMeta(metaCache[integrationId]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${api}?company_id=${companyId}&integration_id=${integrationId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Не удалось загрузить поля');
      metaCache[integrationId] = { fields: data.fields, stages: data.stages || {} };
      setMeta(metaCache[integrationId]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить поля');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTest(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId]);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, integration_id: integrationId, entity_id: testId, mapping })
      });
      setTest(await res.json());
    } catch {
      setTest({ success: false, error: 'Проверьте интернет-соединение' });
    } finally {
      setTesting(false);
    }
  };

  if (!meta) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
        {loading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader2" size={16} className="animate-spin" />
            Загружаем поля из «Мой Класс»...
          </span>
        ) : (
          <>
            <span className="text-destructive">{loadError || 'Поля не загружены'}</span>
            <Button size="sm" variant="outline" onClick={() => load(true)}>Повторить</Button>
          </>
        )}
      </div>
    );
  }

  const fieldsHint = (
    <p className="text-xs text-muted-foreground">
      Лупа — вставить поле: ученик, абонемент, вид абонемента, группа, программа, платёж. Пустые поля в кавычках убираются автоматически
    </p>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {offset ? 'Списание за занятие → зачёт аванса' : 'Оплата абонемента → предоплата'}
          </span>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => load(true)} disabled={loading}>
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={12} className={loading ? 'animate-spin' : ''} />
            Обновить поля
          </Button>
        </div>
        <p>
          Этап задан в интеграции. Признак расчёта берётся из шаблона действия
          {templatePaymentMethod ? <> — сейчас «{METHOD_LABELS[templatePaymentMethod] || templatePaymentMethod}»</> : null}
          {!offset && ', если абонемент оплачен не полностью — частичная предоплата'}.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="text-sm font-medium">Поля чека</div>
        {MAPPING_FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] items-center gap-1 sm:gap-3">
            <span className="text-sm">
              {f.key === 'order_id' ? 'Номер документа' : f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </span>
            <CrmFieldPicker
              value={String(mapping[f.key] || '')}
              onChange={(ref) => set({ [f.key]: ref })}
              fields={meta.fields}
              entities={MOYKLASS_ENTITIES}
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="text-sm font-medium">Состав чека</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MOYKLASS_ITEMS_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set({ items_mode: m.value })}
              className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all ${
                itemsMode === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{MOYKLASS_ITEMS_MODES.find((m) => m.value === itemsMode)?.description}</p>

        {itemsMode === 'single' && (
          <>
            <div className="space-y-1.5">
              <span className="text-sm">Название позиции</span>
              <CrmTemplateInput
                value={String(mapping.single_item_name || '')}
                onChange={(v) => set({ single_item_name: v })}
                fields={meta.fields}
                entities={MOYKLASS_ENTITIES}
                mainEntity="__none__"
                fieldKind="text"
                placeholder={offset ? 'Например: Занятие в группе «{group.name}»' : 'Например: Абонемент «{sub_type.name}»'}
              />
              {fieldsHint}
            </div>
            <div className="space-y-1.5">
              <span className="text-sm">Сумма позиции</span>
              <CrmTemplateInput
                value={String(mapping.single_item_amount || '')}
                onChange={(v) => set({ single_item_amount: v })}
                fields={meta.fields}
                entities={MOYKLASS_ENTITIES}
                mainEntity="__none__"
                fieldKind="number"
                placeholder={`Пусто — сумма ${offset ? 'списания' : 'платежа'}. Например {subscription.lesson_price}`}
              />
              <p className="text-xs text-muted-foreground">
                Можно считать: + - * / и скобки, например <code>{'{subscription.price} / {subscription.visitCount}'}</code>. Пустое поле считается нулём
              </p>
            </div>
          </>
        )}

        {itemsMode === 'fixed' && (
          <div className="space-y-2">
            {fixedItems.map((it, i) => (
              <div key={i} className="space-y-2 rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Позиция {i + 1}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set({ fixed_items: fixedItems.filter((_, j) => j !== i) })}>
                    <Icon name="Trash2" size={14} />
                  </Button>
                </div>
                <CrmTemplateInput
                  value={it.name}
                  onChange={(v) => setFixed(i, { name: v })}
                  fields={meta.fields}
                  entities={MOYKLASS_ENTITIES}
                  mainEntity="__none__"
                  fieldKind="text"
                  placeholder="Название, например: Учебные материалы «{course.name}»"
                />
                <div className="grid grid-cols-[1fr_72px] gap-2">
                  <CrmTemplateInput
                    value={it.price}
                    onChange={(v) => setFixed(i, { price: v })}
                    fields={meta.fields}
                    entities={MOYKLASS_ENTITIES}
                    mainEntity="__none__"
                    fieldKind="number"
                    placeholder="Цена: 500 или {payment.summa} - 500"
                  />
                  <Input className="h-9" placeholder="Кол." inputMode="decimal" value={it.quantity} onChange={(e) => setFixed(i, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Цена — число, поле или формула. Например, разбить оплату на две строки: «Абонемент» на <code>{'{payment.summa} - 500'}</code> и «Учебные материалы» на <code>500</code>
            </p>
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => set({ fixed_items: [...fixedItems, { name: '', price: '', quantity: '1' }] })}>
              <Icon name="Plus" size={14} />
              Добавить позицию
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] items-center gap-1 sm:gap-3">
          <span className="text-sm">НДС</span>
          <Select value={String(mapping.vat || 'none')} onValueChange={(v) => set({ vat: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAT_OPTIONS.filter((o) => o.value !== 'auto').map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="w-full min-w-0 space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <div className="text-sm font-medium">Проверить на реальном {offset ? 'списании' : 'платеже'}</div>
        <div className="flex gap-2">
          <Input
            className="h-9"
            inputMode="numeric"
            placeholder={`ID ${offset ? 'списания' : 'платежа'} в «Мой Класс»`}
            value={testId}
            onChange={(e) => setTestId(e.target.value.replace(/\D/g, ''))}
          />
          <Button size="sm" className="h-9 gap-1" disabled={!testId || testing} onClick={runTest}>
            <Icon name={testing ? 'Loader2' : 'Play'} size={14} className={testing ? 'animate-spin' : ''} />
            Проверить
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">ID есть в «Мой Класс» в карточке ученика → Платежи, или в ленте «События» после первого вебхука</p>

        {test && !test.success && <p className="text-sm text-destructive">{test.error}</p>}
        {test?.success && (
          <div className="w-full min-w-0 space-y-2 text-sm">
            <div className="break-words font-medium first-letter:uppercase">{test.title}</div>
            <div className={`text-xs ${test.stage_matches ? 'text-success' : 'text-warning'}`}>{test.stage_note}</div>
            <div className="space-y-1 rounded-md bg-background/60 p-2 text-xs">
              {MAPPING_FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                  <span className="text-muted-foreground">{f.key === 'order_id' ? 'Номер документа' : f.label}</span>
                  <span className={`min-w-0 break-words text-right ${test.values?.[f.key] ? '' : 'text-muted-foreground'}`}>{test.values?.[f.key] || '—'}</span>
                </div>
              ))}
            </div>
            {test.error ? (
              <p className="text-xs text-destructive">{test.error}</p>
            ) : (
              <div className="w-full min-w-0 space-y-1.5 rounded-md bg-background/60 p-2 text-xs">
                {test.items?.map((it, i) => {
                  const limit = test.name_limit || 128;
                  const full = test.full_names?.[i] ?? it.name;
                  return (
                    <div key={i} className="space-y-1 border-b border-border/60 pb-1.5 last:border-0">
                      <div className="break-words [overflow-wrap:anywhere]">{full}</div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Кол-во: {it.quantity}</span>
                        <span className="shrink-0 font-medium text-foreground">{it.sum.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      {full.length > limit && (
                        <div className="text-warning">Длиннее {limit} символов — в чеке название обрежется</div>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-between pt-1 font-medium">
                  <span>Итого</span>
                  <span>{(test.total || 0).toLocaleString('ru-RU')} ₽</span>
                </div>
                {test.note && <p className="text-muted-foreground">{test.note}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoyklassMappingBlock;
