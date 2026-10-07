import { Label } from '@/components/ui/label';

const ScenarioStep = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{n}</span>
      {title}
    </Label>
    {children}
  </div>
);

export default ScenarioStep;
