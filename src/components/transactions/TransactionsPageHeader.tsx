import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface TransactionsPageHeaderProps {
  backfillPhase: string;
  isRefreshing: boolean;
  onOpenBackfill: () => void;
  onRefresh: () => void;
}

const TransactionsPageHeader = ({ backfillPhase, isRefreshing, onOpenBackfill, onRefresh }: TransactionsPageHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground mb-2">Транзакции</h2>
        <p className="text-muted-foreground">
          Готовые данные для сверки: платежи, чеки и деньги на счету
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onOpenBackfill} variant="outline" className="gap-2">
          <Icon name={backfillPhase === 'running' ? 'Loader2' : 'Download'} size={16} className={backfillPhase === 'running' ? 'animate-spin' : ''} />
          {backfillPhase === 'running' ? 'Загрузка идёт…' : 'Загрузить'}
        </Button>
        <Button onClick={onRefresh} variant="outline" size="icon" title="Обновить" disabled={isRefreshing}>
          <Icon name="RefreshCw" size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </div>
    </div>
  );
};

export default TransactionsPageHeader;
