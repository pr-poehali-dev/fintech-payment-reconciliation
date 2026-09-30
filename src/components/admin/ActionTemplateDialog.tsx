import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { ACTION_TYPE_OPTIONS, ActionTemplateForm, OPERATION_OPTIONS } from './actionTemplatesConfig';

interface ActionTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ActionTemplateForm;
  onChange: (form: ActionTemplateForm) => void;
  onSubmit: () => void;
  isSaving: boolean;
  isEditing: boolean;
  scenariosCount: number;
}

const ActionTemplateDialog = ({ open, onOpenChange, form, onChange, onSubmit, isSaving, isEditing, scenariosCount }: ActionTemplateDialogProps) => {
  const codeValid = /^[a-z][a-z0-9_]{1,49}$/.test(form.code);
  const canSave = !!form.name.trim() && (isEditing || codeValid) && !isSaving;
  const typeLocked = isEditing && scenariosCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Шаблон действия' : 'Новый шаблон действия'}</DialogTitle>
          <DialogDescription>Шаблон появится в списке при настройке автоматизаций во всех компаниях</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={form.name} placeholder="Оплаченный заказ" onChange={(e) => onChange({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Код</Label>
            <Input
              value={form.code}
              disabled={isEditing}
              placeholder="paid_order"
              className="font-mono"
              onChange={(e) => onChange({ ...form, code: e.target.value.toLowerCase() })}
            />
            <p className="text-xs text-muted-foreground">
              {isEditing ? 'Код не меняется — по нему шаблон привязан к сценариям' : 'Латиница, цифры и _, например closing_order'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              rows={2}
              value={form.description}
              placeholder="Когда использовать этот шаблон"
              onChange={(e) => onChange({ ...form, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Тип действия</Label>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={typeLocked}
                  onClick={() => onChange({ ...form, action_type: o.value })}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.action_type === o.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted'
                  }`}
                >
                  <Icon name={o.icon} size={16} className={form.action_type === o.value ? 'text-primary' : 'text-muted-foreground'} />
                  {o.label}
                </button>
              ))}
            </div>
            {typeLocked && <p className="text-xs text-muted-foreground">Используется в сценариях ({scenariosCount}) — тип менять нельзя</p>}
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2">
              <Label>Операция в кассе</Label>
              <Select value={form.operation} onValueChange={(v) => onChange({ ...form, operation: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label} <span className="font-mono text-xs text-muted-foreground">· {o.value}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Порядок</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => onChange({ ...form, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Передавать оплату</div>
                <div className="text-xs text-muted-foreground">Выключено — список оплат пустой (неоплаченный документ)</div>
              </div>
              <Switch checked={form.paid} onCheckedChange={(v) => onChange({ ...form, paid: v })} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Доступен компаниям</div>
                <div className="text-xs text-muted-foreground">Выключенный шаблон нельзя выбрать в новых сценариях</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => onChange({ ...form, is_active: v })} />
            </label>
          </div>
        </div>

        <Button className="w-full gap-2" disabled={!canSave} onClick={onSubmit}>
          <Icon name={isSaving ? 'Loader2' : 'Check'} size={16} className={isSaving ? 'animate-spin' : ''} />
          {isEditing ? 'Сохранить' : 'Создать шаблон'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ActionTemplateDialog;
