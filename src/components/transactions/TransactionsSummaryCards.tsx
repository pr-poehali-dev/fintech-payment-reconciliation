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
  { type: 'money', icon: 'Landmark', title: 'Деньги', showMatched: false }
];

const TransactionsSummaryCards = ({ totalsByType, matchedCountByType, isFiltered = false }: TransactionsSummaryCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <Card key={card.type} className={`bg-card transition-colors ${isFiltered ? 'border-primary/40' : 'border-border'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name={card.icon} size={14} />
              {card.title}
              {isFiltered && (
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-primary">
                  <Icon name="Filter" size={11} />
                  по фильтру
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-foreground">
              {totalsByType[card.type]?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
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