import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';

export interface DateFilter {
  from: Date;
  to: Date;
}

interface TransactionsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showUnmatchedOnly: boolean;
  setShowUnmatchedOnly: (value: boolean) => void;
  dateFilter: DateFilter | null;
  setDateFilter: (value: DateFilter | null) => void;
}

const formatLabel = (f: DateFilter) => {
  const same = f.from.toDateString() === f.to.toDateString();
  return same
    ? format(f.from, 'd MMM yyyy', { locale: ru })
    : `${format(f.from, 'd MMM', { locale: ru })} — ${format(f.to, 'd MMM yyyy', { locale: ru })}`;
};

const TransactionsFilters = ({
  searchQuery,
  setSearchQuery,
  showUnmatchedOnly,
  setShowUnmatchedOnly,
  dateFilter,
  setDateFilter
}: TransactionsFiltersProps) => {
  const [open, setOpen] = useState(false);
  // Черновик выбора: календарь открывается пустым, 1-й клик - начало,
  // 2-й клик (в т.ч. на тот же день) - конец, тогда фильтр применяется.
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
      setDateFilter({ from: selected.from, to: selected.to });
      setOpen(false);
    }
  };

  return (
    // Одна строка без переносов: поиск тянется (но не шире max-w-md), календарь
    // и "Только без связи" - фиксированной ширины (shrink-0). Input из shadcn
    // по умолчанию w-full - поэтому ширину задаём явно, иначе он выталкивает
    // остальные элементы на новую строку.
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <Input
        placeholder="Сумма (2500 или 2 500,00), номер или описание"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1 min-w-[180px] max-w-md w-auto"
      />

      <div className="flex items-center gap-1 shrink-0">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button variant={dateFilter ? 'default' : 'outline'} size="sm" className="gap-2 shrink-0">
              <Icon name="Calendar" size={14} />
              {dateFilter ? formatLabel(dateFilter) : 'Любая дата'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={handleSelect}
              numberOfMonths={2}
              defaultMonth={dateFilter?.from ?? new Date()}
              locale={ru}
            />
          </PopoverContent>
        </Popover>
        {dateFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() => setDateFilter(null)}
            aria-label="Сбросить дату"
          >
            <Icon name="X" size={14} />
          </Button>
        )}
      </div>

      <Button
        variant={showUnmatchedOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => setShowUnmatchedOnly(!showUnmatchedOnly)}
        className="gap-2 shrink-0"
      >
        <Icon name="Unlink" size={14} />
        Только без связи
      </Button>
    </div>
  );
};

export default TransactionsFilters;
