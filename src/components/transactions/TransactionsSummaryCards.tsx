import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { TransactionTotalsByType } from '@/components/transactions/transactionsTypes';

interface TransactionsSummaryCardsProps {
  totalsByType: TransactionTotalsByType;
  matchedCountByType: Partial<Record<string, number>>;
  isFiltered?: boolean;
}

const formatRub = (value: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(value);

const cards: { type: 'payment' | 'receipt_kassa' | 'receipt_ofd' | 'money'; icon: string; title: string; showMatched: boolean }[] = [
  { type: 'payment', icon: 'CreditCard', title: 'Платежи', showMatched: true },
  { type: 'receipt_kassa', icon: 'Receipt', title: 'Чеки кассы', showMatched: true },
  { type: 'receipt_ofd', icon: 'FileCheck', title: 'Чеки ОФД', showMatched: true },
  { type: 'money', icon: 'Landmark', title: 'Деньги', showMatched: true }
];

const TransactionsSummaryCards = ({ totalsByType, matchedCountByType, isFiltered = false }: TransactionsSummaryCardsProps) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
      {cards.map((card) => (
        <Card key={card.type} className={`bg-card transition-colors ${isFiltered ? 'border-primary/40' : 'border-border'}`}>
          <CardHeader className="p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name={card.icon} size={14} />
              {card.title}
              {isFiltered && (
                <span className="ml-auto flex items-center text-primary" title="Итоги по выбранным фильтрам">
                  <Icon name="Filter" size={14} />
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl font-display font-bold text-foreground sm:text-2xl">
              {totalsByType[card.type]?.count ?? 0}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
              {formatRub(totalsByType[card.type]?.amount ?? 0)}
            </div>
            {card.showMatched && (
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Icon name="Link2" size={11} />
                Связано {matchedCountByType[card.type] ?? 0} из {totalsByType[card.type]?.count ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TransactionsSummaryCards;