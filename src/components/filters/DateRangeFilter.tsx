import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { useIsMobile } from '@/hooks/use-mobile';

export interface DateFilter {
  from: Date;
  to: Date;
}

interface DateRangeFilterProps {
  value: DateFilter | null;
  onChange: (value: DateFilter | null) => void;
  onReset?: () => void;
}

const formatLabel = (f: DateFilter) => {
  const same = f.from.toDateString() === f.to.toDateString();
  return same
    ? format(f.from, 'd MMM yyyy', { locale: ru })
    : `${format(f.from, 'd MMM', { locale: ru })} — ${format(f.to, 'd MMM yyyy', { locale: ru })}`;
};

// Черновик выбора: календарь открывается пустым, 1-й клик - начало,
// 2-й клик (в т.ч. на тот же день) - конец, тогда фильтр применяется.
const DateRangeFilter = ({ value, onChange, onReset }: DateRangeFilterProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setDraft(undefined);
  };

  const handleSelect = (selected: DateRange | undefined) => {
    if (!selected?.from) {
      setDraft(undefined);
      return;
    }
    setDraft({ from: selected.from, to: selected.to });
    if (selected.to) {
      onChange({ from: selected.from, to: selected.to });
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant={value ? 'default' : 'outline'} size="sm" className="gap-2 shrink-0">
            <Icon name="Calendar" size={14} />
            {value ? formatLabel(value) : 'Любая дата'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={handleSelect}
            numberOfMonths={isMobile ? 1 : 2}
            defaultMonth={value?.from ?? new Date()}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="sm" className="px-2" onClick={onReset ?? (() => onChange(null))} aria-label="Сбросить дату">
          <Icon name="X" size={14} />
        </Button>
      )}
    </div>
  );
};

export default DateRangeFilter;
