import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';

export interface OverItem {
  id: number | string;
  name: string;
  note: string | null;
  locked: boolean;
}

export interface OverSection {
  limit: number;
  count: number;
  items: OverItem[];
}

export type Overage = Partial<Record<SectionKey, OverSection>>;
export type SectionKey = 'companies' | 'users' | 'integrations' | 'automations';
export type KeepState = Partial<Record<SectionKey, string[]>>;

const SECTIONS: { key: SectionKey; title: string; icon: string; warning: string }[] = [
  {
    key: 'companies',
    title: 'Компании',
    icon: 'Building2',
    warning: 'Удаляется вся компания: транзакции, чеки, интеграции, сценарии, сотрудники и история сверок.'
  },
  { key: 'users', title: 'Пользователи', icon: 'Users', warning: 'Сотрудники потеряют доступ к компании.' },
  {
    key: 'integrations',
    title: 'Интеграции',
    icon: 'Plug',
    warning: 'Удаляются вместе со всеми загруженными платежами, чеками и связанными сценариями.'
  },
  { key: 'automations', title: 'Сценарии автоматизации', icon: 'Workflow', warning: 'Удаляются вместе с журналом.' }
];

export const initialKeep = (over: Overage): KeepState => {
  const keep: KeepState = {};
  for (const { key } of SECTIONS) {
    const sec = over[key];
    if (!sec) continue;
    const locked = sec.items.filter((i) => i.locked).map((i) => String(i.id));
    const rest = sec.items.filter((i) => !i.locked).map((i) => String(i.id));
    keep[key] = [...locked, ...rest.slice(0, Math.max(0, sec.limit - locked.length))];
  }
  return keep;
};

export const keepIsValid = (over: Overage, keep: KeepState) =>
  SECTIONS.every(({ key }) => {
    const sec = over[key];
    return !sec || (keep[key] || []).length <= sec.limit;
  });

export const removalCount = (over: Overage, keep: KeepState) =>
  SECTIONS.reduce((sum, { key }) => {
    const sec = over[key];
    return sec ? sum + sec.items.length - (keep[key] || []).length : sum;
  }, 0);

interface Props {
  overage: Overage;
  keep: KeepState;
  onChange: (keep: KeepState) => void;
}

const DowngradeKeepPicker = ({ overage, keep, onChange }: Props) => {
  const toggle = (key: SectionKey, id: string) => {
    const current = keep[key] || [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ ...keep, [key]: next });
  };

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ key, title, icon, warning }) => {
        const sec = overage[key];
        if (!sec) return null;
        const chosen = keep[key] || [];
        const full = chosen.length >= sec.limit;
        const over = chosen.length > sec.limit;
        return (
          <div key={key} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <span className="flex items-center gap-2 font-medium">
                <Icon name={icon} size={16} />
                {title}
              </span>
              <span className={`text-sm font-medium ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
                Оставить: {chosen.length} из {sec.limit}
              </span>
            </div>
            <div className="px-4 pt-2 text-xs text-muted-foreground">{warning}</div>
            <div className="divide-y divide-border">
              {sec.items.map((item) => {
                const id = String(item.id);
                const checked = chosen.includes(id);
                const disabled = item.locked || (!checked && full);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                      disabled && !checked ? 'opacity-50' : 'cursor-pointer'
                    } ${!checked ? 'bg-destructive/5' : ''}`}
                  >
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(key, id)} />
                    <span className={`flex-1 ${!checked ? 'text-destructive line-through' : ''}`}>{item.name}</span>
                    {item.note && <span className="text-xs text-muted-foreground">{item.note}</span>}
                    {item.locked && <Icon name="Lock" size={12} className="text-muted-foreground" />}
                    {!checked && <span className="text-xs font-medium text-destructive">Будет удалено</span>}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DowngradeKeepPicker;
