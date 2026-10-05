import { useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { CrmField, ENTITY_LABELS } from './automationConfig';

interface CrmTemplateInputProps {
  value: string;
  onChange: (value: string) => void;
  fields: Record<string, CrmField[]>;
  entities: string[];
  mainEntity: string;
  placeholder?: string;
}

interface Option {
  entity: string;
  field: CrmField;
  token: string;
}

// Текст с подстановкой полей CRM. Лупа включает поиск: введённое после неё ищется
// по названию поля, выбранное поле вставляется кодом ({TITLE}, {contact.NAME}).
const CrmTemplateInput = ({ value, onChange, fields, entities, mainEntity, placeholder }: CrmTemplateInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const searching = anchor !== null;
  const query = searching ? value.slice(anchor, Math.max(anchor, cursor)).trim().toLowerCase() : '';

  const options = useMemo<Option[]>(() => entities.flatMap((e) => (fields[e] || []).map((f) => ({
    entity: e,
    field: f,
    token: e === mainEntity ? `{${f.code}}` : `{${e}.${f.code}}`
  }))), [fields, entities, mainEntity]);

  const found = useMemo(() => {
    if (!searching) return [];
    const list = query
      ? options.filter((o) => `${o.field.title} ${o.field.code} ${ENTITY_LABELS[o.entity] || ''}`.toLowerCase().includes(query))
      : options;
    return list.slice(0, 50);
  }, [options, query, searching]);

  const labelOf = (token: string) => {
    const ref = token.slice(1, -1);
    const [entity, code] = ref.includes('.') ? ref.split('.', 2) : [mainEntity, ref];
    const field = fields[entity]?.find((f) => f.code === code);
    return field ? `${ENTITY_LABELS[entity] || entity}: ${field.title}` : null;
  };
  const used = Array.from(new Set(value.match(/\{[\w.]+\}/g) || []));

  const startSearch = () => {
    const el = inputRef.current;
    if (searching) {
      setAnchor(null);
      return;
    }
    const pos = el?.selectionStart ?? value.length;
    setAnchor(pos);
    setCursor(pos);
    setActive(0);
    el?.focus();
  };

  const pick = (o: Option) => {
    if (anchor === null) return;
    const end = Math.max(anchor, cursor);
    const next = value.slice(0, anchor) + o.token + value.slice(end);
    onChange(next);
    setAnchor(null);
    const pos = anchor + o.token.length;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const syncCursor = () => {
    const pos = inputRef.current?.selectionStart ?? 0;
    setCursor(pos);
    if (anchor !== null && pos < anchor) setAnchor(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={inputRef}
          className={`h-9 pr-10 ${searching ? 'border-primary ring-1 ring-primary' : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setCursor(e.target.selectionStart ?? e.target.value.length);
            setActive(0);
          }}
          onSelect={syncCursor}
          onBlur={() => setTimeout(() => setAnchor(null), 150)}
          onKeyDown={(e) => {
            if (!searching) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              setAnchor(null);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, found.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && found[active]) {
              e.preventDefault();
              pick(found[active]);
            }
          }}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startSearch}
          title={searching ? 'Выключить поиск поля' : 'Вставить поле CRM'}
          className={`absolute right-1 top-1 flex h-7 w-8 items-center justify-center rounded-md transition-colors ${
            searching ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Icon name="Search" size={15} />
        </button>

        {searching && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 shadow-lg">
            {found.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Поле не найдено</div>
            ) : (
              found.map((o, i) => (
                <button
                  key={`${o.entity}.${o.field.code}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                    i === active ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'
                  }`}
                >
                  <span className="shrink-0 text-xs text-muted-foreground">{ENTITY_LABELS[o.entity] || o.entity}</span>
                  <span className="min-w-0 flex-1 truncate" title={o.field.title}>{o.field.title}</span>
                  <span className="ml-2 max-w-[40%] shrink-0 truncate font-mono text-[10px] opacity-60">{o.token}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {searching ? (
        <p className="text-xs text-primary">Печатайте название поля — выберите его в списке. Esc — обычный текст.</p>
      ) : used.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {used.map((t) => {
            const label = labelOf(t);
            return (
              <span
                key={t}
                className={`rounded border px-1.5 py-0.5 text-xs ${
                  label ? 'border-border text-muted-foreground' : 'border-destructive/50 text-destructive'
                }`}
                title={t}
              >
                <span className="font-mono">{t}</span> — {label || 'поле не найдено в CRM'}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Нажмите на лупу, чтобы вставить поле CRM по названию</p>
      )}
    </div>
  );
};

export default CrmTemplateInput;
