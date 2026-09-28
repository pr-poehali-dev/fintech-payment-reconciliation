import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface TransactionsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  showUnmatchedOnly: boolean;
  setShowUnmatchedOnly: (value: boolean) => void;
}

const TransactionsFilters = ({
  searchQuery,
  setSearchQuery,
  showUnmatchedOnly,
  setShowUnmatchedOnly
}: TransactionsFiltersProps) => {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Input
        placeholder="Поиск по номеру, сумме, описанию..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-md"
      />

      <Button
        variant={showUnmatchedOnly ? 'default' : 'outline'}
        size="sm"
        onClick={() => setShowUnmatchedOnly(!showUnmatchedOnly)}
        className="gap-2 ml-auto"
      >
        <Icon name="Unlink" size={14} />
        Только без пары
      </Button>
    </div>
  );
};

export default TransactionsFilters;
