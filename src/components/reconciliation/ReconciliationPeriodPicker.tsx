import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';

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
  const [open, setOpen] = useState(false);
  const maxDate = yesterday();

  const range: DateRange = { from: dateFrom, to: dateTo };

  const handleSelect = (selected: DateRange | undefined) => {
    if (!selected?.from) return;
    const from = selected.from;
    const to = selected.to && selected.to <= maxDate ? selected.to : (selected.from <= maxDate ? selected.from : maxDate);
    onChange(from > maxDate ? maxDate : from, to);
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Icon name="Calendar" size={14} />
            {format(dateFrom, 'd MMM', { locale: ru })} — {format(dateTo, 'd MMM yyyy', { locale: ru })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleSelect}
            disabled={{ after: maxDate }}
            numberOfMonths={2}
            defaultMonth={dateFrom}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ReconciliationPeriodPicker;
