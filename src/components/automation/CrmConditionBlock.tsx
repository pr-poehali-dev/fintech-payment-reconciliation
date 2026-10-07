import { KeyboardEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import CrmFieldPicker from './CrmFieldPicker';
import { CrmField, ENTITY_LABELS } from './automationConfig';

interface CrmConditionBlockProps {
  mapping: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
  fields: Record<string, CrmField[]>;
  entity: string;
}

// Условие запуска: поле сделки/лида и значения, при которых сценарий срабатывает.
const CrmConditionBlock = ({ mapping, set, fields, entity }: CrmConditionBlockProps) => {
  const [draft, setDraft] = useState('');
  const ref = String(mapping.condition_field || '');
  const values = (Array.isArray(mapping.condition_values) ? mapping.condition_values : []) as string[];
  const [src, code] = ref.includes('.') ? ref.split('.', 2) : [entity, ref];
  const field = (fields[src] || []).find((f) => f.code === code);
  const options = field?.items || [];
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label || v;

  const save = (next: string[], f: CrmField | undefined = field) => {
    const labels = Object.fromEntries((f?.items || []).filter((o) => next.includes(o.value)).map((o) => [o.value, o.label]));
    set({
      condition_values: next,
      condition_labels: labels,
      condition_values_text: next.map((v) => labels[v] || v).join(', ')
    });
  };

  const pickField = (newRef: string) => {
    const [s, c] = newRef.includes('.') ? newRef.split('.', 2) : [entity, newRef];
    const f = (fields[s] || []).find((x) => x.code === c);
    set({
      condition_field: newRef,
      condition_field_title: f ? `${ENTITY_LABELS[s] || s}: ${f.title}` : '',
      condition_values: [],
      condition_labels: {},
      condition_values_text: ''
    });
  };

  const toggle = (v: string) => save(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const addDraft = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) save([...values, v]);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDraft();
    }
  };

  const noun = entity === 'lead' ? 'лида' : 'сделки';

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon name="Filter" size={14} className="text-primary" />
        Условие запуска
      </div>
      <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[1fr_1.4fr] sm:gap-3">
        <span className="text-sm">Поле {noun}</span>
        <CrmFieldPicker
          value={ref}
          onChange={pickField}
          fields={fields}
          entities={[entity]}
          placeholder="Без условия — по каждому хуку"
        />
      </div>

      {ref && (
        <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[1fr_1.4fr] sm:gap-3">
          <span className="text-sm sm:pt-2">Значение</span>
          {options.length > 0 ? (
            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border border-border p-1">
              {options.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                  <Checkbox checked={values.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                  <span className="min-w-0 break-words">{o.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="min-w-0 space-y-2">
              <div className="flex gap-2">
                <Input
                  className="h-9 min-w-0 flex-1"
                  placeholder="Например: Дом 16"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKey}
                />
                <Button size="sm" variant="outline" className="h-9 shrink-0" disabled={!draft.trim()} onClick={addDraft}>
                  <Icon name="Plus" size={14} />
                </Button>
              </div>
              {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {values.map((v) => (
                    <Badge key={v} variant="secondary" className="gap-1 pr-1">
                      {labelOf(v)}
                      <button type="button" className="rounded p-0.5 hover:bg-background/60" onClick={() => toggle(v)} aria-label="Убрать">
                        <Icon name="X" size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {!ref
          ? `Документ создаётся по каждой ${entity === 'lead' ? 'заявке' : 'сделке'} воронки`
          : values.length
            ? `Документ создаётся, только если поле равно: ${values.map(labelOf).join(' или ')}. Другое значение или пустое поле — пропуск`
            : 'Значение не выбрано — документ создаётся при любом заполненном значении, пустое поле — пропуск'}
      </p>
    </div>
  );
};

export default CrmConditionBlock;
