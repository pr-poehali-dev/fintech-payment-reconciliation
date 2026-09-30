import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { TransactionType } from '@/components/transactions/transactionsTypes';
import { typeConfig } from '@/components/transactions/table/tableHelpers';

const TYPE_OPTIONS: TransactionType[] = ['payment', 'receipt_kassa', 'receipt_order', 'receipt_ofd', 'money'];

interface TransactionTypeFilterButtonProps {
  value: TransactionType[];
  onChange: (value: TransactionType[]) => void;
}

// Пустой выбор = все виды записей (состояние по умолчанию, без цифры на кнопке).
const TransactionTypeFilterButton = ({ value, onChange }: TransactionTypeFilterButtonProps) => {
  const [open, setOpen] = useState(false);
  const count = value.length;

  const toggle = (type: TransactionType) => {
    onChange(value.includes(type) ? value.filter((t) => t !== type) : [...value, type]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'default' : 'outline'}
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label="Фильтр по видам записей"
          title="Фильтр по видам записей"
        >
          <Icon name="SlidersHorizontal" size={16} />
          {count > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Виды записей</span>
          {count > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onChange([])}
            >
              Сбросить
            </button>
          )}
        </div>
        <div className="space-y-1 p-2">
          {TYPE_OPTIONS.map((type) => {
            const config = typeConfig[type];
            const checked = value.includes(type);
            return (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(type)} />
                <Icon name={config.icon} size={14} className="text-muted-foreground" />
                <span>{config.label}</span>
              </label>
            );
          })}
        </div>
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Ничего не отмечено — показываются все записи
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default TransactionTypeFilterButton;
