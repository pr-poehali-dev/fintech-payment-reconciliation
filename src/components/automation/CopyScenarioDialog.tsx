import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';

interface CompanyOption {
  id: number;
  name: string;
}

interface CopyScenarioDialogProps {
  scenario: { name: string } | null;
  title?: string;
  hint?: string;
  companies: CompanyOption[];
  currentCompanyId: number | null;
  isCopying: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (targetCompanyId: number, name: string) => void;
}

// Копирование сценария: в эту же компанию или в другую компанию пользователя.
const CopyScenarioDialog = ({ scenario, title = 'Копировать сценарий', hint, companies, currentCompanyId, isCopying, onOpenChange, onCopy }: CopyScenarioDialogProps) => {
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (scenario) {
      setTarget(String(currentCompanyId || ''));
      setName(`${scenario.name} (копия)`.slice(0, 200));
    }
  }, [scenario, currentCompanyId]);

  const other = target !== String(currentCompanyId);

  return (
    <Dialog open={!!scenario} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{title === 'Копировать сценарий' ? 'Копия создаётся остановленной — проверьте настройки и запустите' : 'Копия получит те же настройки и ключи'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Компания</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите компанию" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                    {c.id === currentCompanyId && <span className="ml-1 text-xs text-muted-foreground">(текущая)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {other && (
            <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              {hint ? <p>{hint}</p> : (
                <>
                  <p>Касса — ищем такую же кассу в выбранной компании. Если её нет, подключите кассу и повторите.</p>
                  <p>Источник — берём такую же интеграцию из выбранной компании, а если её нет, копируем вместе со сценарием. У копии будет свой адрес для хука.</p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button disabled={!target || !name.trim() || isCopying} onClick={() => onCopy(Number(target), name.trim())}>
            {isCopying ? <Icon name="Loader2" size={16} className="mr-2 animate-spin" /> : <Icon name="Copy" size={16} className="mr-2" />}
            Копировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CopyScenarioDialog;
