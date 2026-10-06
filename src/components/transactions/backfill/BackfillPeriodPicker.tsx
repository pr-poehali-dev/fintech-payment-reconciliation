import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useIsMobile } from '@/hooks/use-mobile';

interface BackfillPeriodPickerProps {
  dateRange: DateRange;
  dateFrom: Date;
  dateTo: Date;
  maxDate: Date;
  disabled: boolean;
  onChange: (range: DateRange) => void;
}

const BackfillPeriodPicker = ({ dateRange, dateFrom, dateTo, maxDate, disabled, onChange }: BackfillPeriodPickerProps) => {
  const isMobile = useIsMobile();
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Период</Label>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 w-full justify-start" disabled={disabled}>
            <Icon name="Calendar" size={14} />
            {format(dateFrom, 'd MMM yyyy', { locale: ru })} — {format(dateTo, 'd MMM yyyy', { locale: ru })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => {
              if (!range?.from) return;
              // react-day-picker сбрасывает диапазон до {from, to: undefined}
              // при начале нового выбора - всегда пишем то, что вернул picker,
              // без подмешивания предыдущего to (иначе период "с X по X" не
              // выбирается и календарь не закрывается).
              onChange({ from: range.from, to: range.to });
              if (range.to) setCalendarOpen(false);
            }}
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

export default BackfillPeriodPicker;
