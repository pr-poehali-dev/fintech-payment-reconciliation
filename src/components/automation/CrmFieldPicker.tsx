import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { CrmField, ENTITY_LABELS } from './automationConfig';

interface CrmFieldPickerProps {
  value: string;
  onChange: (ref: string) => void;
  fields: Record<string, CrmField[]>;
  entities: string[];
  placeholder?: string;
}

// Выбор поля CRM из реального списка (сделка/лид + контакт + компания) с поиском по названию и коду.
const CrmFieldPicker = ({ value, onChange, fields, entities, placeholder = 'Не выбрано' }: CrmFieldPickerProps) => {
  const [open, setOpen] = useState(false);
  const [entity, code] = value.includes('.') ? value.split('.', 2) : ['', value];
  const current = fields[entity]?.find((f) => f.code === code);
  const label = value ? `${ENTITY_LABELS[entity] || entity}: ${current?.title || code}` : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-full justify-between px-3 font-normal">
          <span className={`truncate ${value ? '' : 'text-muted-foreground'}`}>{label}</span>
          <Icon name="ChevronsUpDown" size={14} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] sm:min-w-[420px] max-w-[calc(100vw-1.5rem)] p-0" align="end">
        <Command>
          <CommandInput placeholder="Поиск поля..." />
          <CommandList className="max-h-80 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
            <CommandEmpty>Поле не найдено</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => { onChange(''); setOpen(false); }}>
                  <Icon name="X" size={14} className="mr-2 text-muted-foreground" />
                  Не заполнять
                </CommandItem>
              </CommandGroup>
            )}
            {entities.map((e) => (
              <CommandGroup key={e} heading={ENTITY_LABELS[e] || e}>
                {(fields[e] || []).map((f) => (
                  <CommandItem
                    key={f.ref}
                    value={`${ENTITY_LABELS[e]} ${f.title} ${f.code}`}
                    onSelect={() => { onChange(f.ref); setOpen(false); }}
                  >
                    <Icon name="Check" size={14} className={`mr-2 ${f.ref === value ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="min-w-0 flex-1 truncate" title={f.title}>{f.title}</span>
                    <span className="ml-2 max-w-[45%] shrink-0 truncate font-mono text-[10px] text-muted-foreground" title={f.code}>{f.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CrmFieldPicker;
