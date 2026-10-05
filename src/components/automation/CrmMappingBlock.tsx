import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import functionUrls from '../../../backend/func2url.json';
import CrmFieldPicker from './CrmFieldPicker';
import CrmTemplateInput from './CrmTemplateInput';
import {
  CrmEntity,
  CrmMeta,
  FixedItem,
  ItemsMode,
  ITEMS_MODES,
  AGENT_MAPPING_FIELDS,
  MAPPING_FIELDS,
  VAT_OPTIONS
} from './automationConfig';

interface CrmMappingBlockProps {
  companyId: number;
  integrationId: number;
  mapping: Record<string, unknown>;
  onChange: (mapping: Record<string, unknown>) => void;
  agentReceipt?: boolean;
  // Поставщик из шаблона действия и из блока «Агентский чек» сценария - для показа итогового значения.
  agentTemplate?: Record<string, string | string[]>;
  agentScenario?: Record<string, string | string[]>;
}

const agentText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v || '').trim();

interface TestResult {
  success: boolean;
  error?: string | null;
  title?: string;
  stage?: string;
  stage_matches?: boolean;
  has_contact?: boolean;
  has_company?: boolean;
  values?: Record<string, string | null>;
  items?: { name: string; price: number; quantity: number; sum: number; vat: { type: string } }[];
  total?: number;
  note?: string | null;
  name_limit?: number;
  full_names?: string[];
}

const api = (functionUrls as Record<string, string>)['crm-fields'];
// Кеш справочника на время сессии: при повторном открытии диалога Битрикс24 не дёргаем.
const metaCache: Record<number, CrmMeta> = {};

const CrmMappingBlock = ({ companyId, integrationId, mapping, onChange, agentReceipt, agentTemplate = {}, agentScenario = {} }: CrmMappingBlockProps) => {
  const [meta, setMeta] = useState<CrmMeta | null>(metaCache[integrationId] || null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testId, setTestId] = useState('');
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  const entity = (mapping.entity as CrmEntity) || 'deal';
  const itemsMode = (mapping.items_mode as ItemsMode) || 'products';
  const fixedItems = (mapping.fixed_items as FixedItem[]) || [];
  const stages = (String(mapping.stage || '')).split(',').filter(Boolean);
  const set = (patch: Record<string, unknown>) => onChange({ ...mapping, ...patch });

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
      metaCache[integrationId] = { fields: data.fields, stages: data.stages };
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

  const setEntity = (value: CrmEntity) => {
    const swap = (ref: unknown) => (typeof ref === 'string' && ref.startsWith(`${entity}.`) ? ref.replace(`${entity}.`, `${value}.`) : ref);
    const next: Record<string, unknown> = { ...mapping, entity: value, pipeline: '', stage: '' };
    [...MAPPING_FIELDS, ...AGENT_MAPPING_FIELDS].forEach((f) => { next[f.key] = swap(mapping[f.key]); });
    if (value === 'lead' && next.order_id === 'lead.ID') next.single_item_name = 'Оплата по заявке №{ID}';
    onChange(next);
    setTest(null);
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, integration_id: integrationId, entity, entity_id: testId, mapping })
      });
      setTest(await res.json());
    } catch {
      setTest({ success: false, error: 'Проверьте интернет-соединение' });
    } finally {
      setTesting(false);
    }
  };

  const setFixed = (index: number, patch: Partial<FixedItem>) =>
    set({ fixed_items: fixedItems.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  if (!meta) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
        {loading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader2" size={16} className="animate-spin" />
            Загружаем поля из Битрикс24...
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

  const entities = [entity, 'contact', 'company'];
  // Воронки сделок - из стадий (group_id - номер воронки в Битрикс24). У лидов воронок нет.
  const pipelines = entity === 'deal'
    ? meta.stages.deal.reduce<{ id: string; name: string; count: number }[]>((acc, s) => {
        const id = s.group_id || '0';
        const found = acc.find((p) => p.id === id);
        if (found) found.count += 1;
        else acc.push({ id, name: s.group || `Воронка ${id}`, count: 1 });
        return acc;
      }, [])
    : [];
  const pipeline = String(mapping.pipeline || '');
  // Сценарий, настроенный до выбора воронки: воронку берём по сохранённой стадии.
  const stagePipeline = meta.stages.deal.find((s) => s.value === stages[0])?.group_id || '';
  const activePipeline = pipeline || stagePipeline;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Объект CRM</span>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => load(true)} disabled={loading}>
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={12} className={loading ? 'animate-spin' : ''} />
            Обновить поля
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['deal', 'lead'] as CrmEntity[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEntity(e)}
              className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                entity === e ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {e === 'deal' ? 'Сделки' : 'Лиды'}
            </button>
          ))}
        </div>

        {entity === 'deal' && (
          <div className="space-y-1.5">
            <span className="text-sm">Воронка</span>
            <Select value={activePipeline || undefined} onValueChange={(v) => set({ pipeline: v, stage: '' })}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Выберите воронку" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} <span className="ml-1 text-[10px] text-muted-foreground">{p.count} стад.</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {entity === 'deal'
            ? 'Документ создаётся по каждому хуку Битрикс24 по сделке из этой воронки — на любой стадии, один раз на сделку'
            : 'Документ создаётся по каждому хуку Битрикс24 по лиду — один раз на лид'}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="text-sm font-medium">Поля чека</div>
        {MAPPING_FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
            <span className="text-sm">
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </span>
            <CrmFieldPicker
              value={String(mapping[f.key] || '')}
              onChange={(ref) => set({ [f.key]: ref })}
              fields={meta.fields}
              entities={entities}
            />
          </div>
        ))}
      </div>

      {agentReceipt && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="text-sm font-medium">Агентский чек: поставщик</div>
          <p className="text-xs text-muted-foreground">Если поле не выбрано или пустое в сделке — возьмём значение из шаблона или блока «Агентский чек»</p>
          {AGENT_MAPPING_FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
              <span className="text-sm">{f.label}</span>
              <CrmFieldPicker
                value={String(mapping[f.key] || '')}
                onChange={(ref) => set({ [f.key]: ref })}
                fields={meta.fields}
                entities={entities}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="text-sm font-medium">Состав чека</div>
        <div className="grid grid-cols-3 gap-2">
          {ITEMS_MODES.map((m) => (
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
        <p className="text-xs text-muted-foreground">{ITEMS_MODES.find((m) => m.value === itemsMode)?.description}</p>

        {itemsMode === 'fixed' && (
          <div className="space-y-2">
            {fixedItems.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_60px_32px] gap-2">
                <Input className="h-9" placeholder="Название" value={it.name} onChange={(e) => setFixed(i, { name: e.target.value })} />
                <Input className="h-9" placeholder="Цена" inputMode="decimal" value={it.price} onChange={(e) => setFixed(i, { price: e.target.value.replace(/[^\d.,]/g, '') })} />
                <Input className="h-9" placeholder="Кол." inputMode="decimal" value={it.quantity} onChange={(e) => setFixed(i, { quantity: e.target.value.replace(/[^\d.,]/g, '') })} />
                <Button size="icon" variant="ghost" className="h-9 w-8" onClick={() => set({ fixed_items: fixedItems.filter((_, j) => j !== i) })}>
                  <Icon name="Trash2" size={14} />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => set({ fixed_items: [...fixedItems, { name: '', price: '', quantity: '1' }] })}>
              <Icon name="Plus" size={14} />
              Добавить позицию
            </Button>
          </div>
        )}

        {itemsMode === 'single' && (
          <div className="space-y-1.5">
            <span className="text-sm">Название позиции</span>
            <CrmTemplateInput
              value={String(mapping.single_item_name || '')}
              onChange={(v) => set({ single_item_name: v })}
              fields={meta.fields}
              entities={entities}
              mainEntity={entity}
            />
          </div>
        )}

        <div className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
          <span className="text-sm">НДС</span>
          <Select value={String(mapping.vat || 'auto')} onValueChange={(v) => set({ vat: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAT_OPTIONS.filter((o) => itemsMode === 'products' || o.value !== 'auto').map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {itemsMode === 'single' && (
          <div className="space-y-1.5">
            <span className="text-sm">Сумма позиции</span>
            <CrmTemplateInput
              value={String(mapping.single_item_amount || '')}
              onChange={(v) => set({ single_item_amount: v })}
              fields={meta.fields}
              entities={entities}
              mainEntity={entity}
              placeholder="Пусто — из поля «Сумма». Например {OPPORTUNITY} - {UF_CRM_...}"
            />
            <p className="text-xs text-muted-foreground">Лупа — выбрать поле сделки. Можно считать: + - * / и скобки, например <code>{'{OPPORTUNITY} - {UF_CRM_предоплата}'}</code>. Пустое поле сделки считается нулём. Если всё поле суммы пусто — берём «Сумма» из сопоставления</p>
          </div>
        )}
      </div>

      <div className="w-full min-w-0 space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <div className="text-sm font-medium">Проверить на реальной {entity === 'deal' ? 'сделке' : 'заявке'}</div>
        <div className="flex gap-2">
          <Input
            className="h-9"
            inputMode="numeric"
            placeholder={`Номер ${entity === 'deal' ? 'сделки' : 'лида'} в Битрикс24`}
            value={testId}
            onChange={(e) => setTestId(e.target.value.replace(/\D/g, ''))}
          />
          <Button size="sm" className="h-9 gap-1" disabled={!testId || testing} onClick={runTest}>
            <Icon name={testing ? 'Loader2' : 'Play'} size={14} className={testing ? 'animate-spin' : ''} />
            Проверить
          </Button>
        </div>

        {test && !test.success && <p className="text-sm text-destructive">{test.error}</p>}
        {test?.success && (
          <div className="w-full min-w-0 space-y-2 text-sm">
            <div className="break-words font-medium">«{test.title}»</div>
            <div className={`text-xs ${test.stage_matches ? 'text-success' : 'text-warning'}`}>
              Стадия {test.stage} — {test.stage_matches ? 'документ будет создан' : 'сделка из другой воронки'}
            </div>
            <div className="space-y-1 rounded-md bg-background/60 p-2 text-xs">
              {MAPPING_FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className={`min-w-0 whitespace-pre-wrap break-words text-right ${test.values?.[f.key] ? '' : 'text-muted-foreground'}`}>{test.values?.[f.key] || '—'}</span>
                </div>
              ))}
              {agentReceipt &&
                AGENT_MAPPING_FIELDS.map((f) => {
                  // Порядок как при создании чека: шаблон действия > поле сделки > значение из сценария.
                  const fromTemplate = agentText(agentTemplate[f.agentKey]);
                  const fromCrm = (test.values?.[f.key] || '').trim();
                  const fromScenario = agentText(agentScenario[f.agentKey]);
                  const [value, source] = fromTemplate
                    ? [fromTemplate, 'из шаблона']
                    : fromCrm
                      ? [fromCrm, 'из сделки']
                      : fromScenario
                        ? [fromScenario, mapping[f.key] ? 'из сценария — в сделке пусто' : 'из сценария']
                        : ['', ''];
                  return (
                    <div key={f.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="min-w-0 whitespace-pre-wrap break-words text-right">
                        {value ? (
                          <>
                            {value} <span className="text-[11px] text-muted-foreground">· {source}</span>
                          </>
                        ) : (
                          <span className="text-destructive">не задано</span>
                        )}
                      </span>
                    </div>
                  );
                })}
            </div>
            {test.error ? (
              <p className="text-xs text-destructive">{test.error}</p>
            ) : (
              <div className="w-full min-w-0 space-y-1.5 rounded-md bg-background/60 p-2 text-xs">
                {test.items?.map((it, i) => {
                  const limit = test.name_limit || 128;
                  const full = test.full_names?.[i] ?? it.name;
                  const over = full.length > limit;
                  return (
                    <div key={i} className="space-y-1 border-b border-border/60 pb-1.5 last:border-0">
                      <div className="w-full min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{full}</div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Кол-во: {it.quantity}</span>
                        <span className="shrink-0 font-medium text-foreground">{it.sum.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className={`break-words text-[11px] ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {full.length} / {limit} символов
                        {over && ` — не влезает по ФФД на ${full.length - limit}, в чек уйдёт обрезанным: «…${full.slice(limit - 20, limit)}». Сократите шаблон названия`}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-border pt-1 font-semibold">
                  <span>Итого в чеке</span>
                  <span>{(test.total || 0).toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
            )}
            {test.note && <p className="text-xs text-warning">{test.note}</p>}
            {!test.has_contact && <p className="text-xs text-muted-foreground">У {entity === 'deal' ? 'сделки' : 'лида'} нет контакта — поля контакта будут пустыми</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrmMappingBlock;