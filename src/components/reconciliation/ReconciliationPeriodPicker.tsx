import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { useIsMobile } from '@/hooks/use-mobile';

interface ReconciliationPeriodPickerProps {
  dateFrom: Date;
  dateTo: Date;
  onChange: (from: Date, to: Date) => void;
}

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const PRESETS = [
  { label: 'Вчера', getRange: () => ({ from: yesterday(), to: yesterday() }) },
  {
    label: '7 дней',
    getRange: () => {
      const to = yesterday();
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      return { from, to };
    }
  },
  {
    label: '30 дней',
    getRange: () => {
      const to = yesterday();
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      return { from, to };
    }
  },
  {
    label: 'Этот месяц',
    getRange: () => {
      const to = yesterday();
      const from = new Date(to.getFullYear(), to.getMonth(), 1);
      return { from: from > to ? to : from, to };
    }
  }
];

const ReconciliationPeriodPicker = ({ dateFrom, dateTo, onChange }: ReconciliationPeriodPickerProps) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const maxDate = yesterday();

  // Черновик выбора внутри открытого календаря. Раньше в календарь всегда
  // передавался полный диапазон (to подставлялся = from сразу после первого
  // клика), поэтому календарь не видел "начатый" выбор и повторный клик на
  // тот же день не давал период "с X по X". Теперь при открытии черновик
  // пустой: 1-й клик - начало, 2-й клик (в т.ч. на тот же день) - конец,
  // и только тогда период применяется и календарь закрывается.
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
      const from = selected.from > maxDate ? maxDate : selected.from;
      const to = selected.to > maxDate ? maxDate : selected.to;
      onChange(from, to);
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          onClick={() => {
            const r = preset.getRange();
            onChange(r.from, r.to);
          }}
        >
          {preset.label}
        </Button>
      ))}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Icon name="Calendar" size={14} />
            {format(dateFrom, 'd MMM', { locale: ru })} — {format(dateTo, 'd MMM yyyy', { locale: ru })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={handleSelect}
            disabled={{ after: maxDate }}
            numberOfMonths={isMobile ? 1 : 2}
            defaultMonth={dateFrom}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ReconciliationPeriodPicker;