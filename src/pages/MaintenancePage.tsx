import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface MaintenancePageProps {
  message?: string | null;
  until?: string | null;
}

const formatUntil = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const STEPS = [
  { label: 'Платежи и вебхуки', value: 'принимаются', ok: true },
  { label: 'Данные компании', value: 'в сохранности', ok: true },
  { label: 'Личный кабинет', value: 'обновляется', ok: false }
];

const MaintenancePage = ({ message, until }: MaintenancePageProps) => (
  <div className="relative min-h-screen overflow-hidden bg-background text-foreground flex flex-col">
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)'
      }}
    />
    <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />

    <header className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
      <div className="flex items-center gap-2">
        <Icon name="Zap" size={24} className="text-primary" />
        <span className="text-lg font-display font-bold">Сверка</span>
      </div>
    </header>

    <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
          Технические работы
        </div>

        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-card/80">
          <Icon name="Settings" size={48} className="text-primary animate-[spin_6s_linear_infinite]" />
        </div>

        <h1 className="font-display font-semibold text-3xl sm:text-5xl leading-tight">
          Сайт временно <span className="text-primary">недоступен</span>
        </h1>
        <p className="mt-4 text-muted-foreground max-w-md mx-auto whitespace-pre-line">
          {message || 'Мы обновляем сервис, чтобы сверка работала ещё быстрее. Это ненадолго.'}
        </p>
        {until && (
          <p className="mt-3 text-sm text-foreground">
            Вернёмся примерно к <span className="text-primary font-medium">{formatUntil(until)}</span>
          </p>
        )}

        <div className="mt-8 mx-auto max-w-sm rounded-xl border border-border bg-card/80 backdrop-blur text-left text-sm">
          {STEPS.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon
                  name={row.ok ? 'CircleCheck' : 'Loader2'}
                  size={15}
                  className={row.ok ? 'text-primary' : 'text-warning animate-spin'}
                />
                {row.label}
              </span>
              <span className={row.ok ? 'text-foreground' : 'text-warning'}>{row.value}</span>
            </div>
          ))}
        </div>

        <Button size="lg" variant="outline" className="mt-8 gap-2" onClick={() => window.location.reload()}>
          <Icon name="RefreshCw" size={16} />
          Проверить снова
        </Button>
      </div>
    </main>
  </div>
);

export default MaintenancePage;
