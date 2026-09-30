import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface DetachButtonProps {
  onClick: () => void;
  isLoading: boolean;
  withLabel?: boolean;
}

// Кнопка-магнит "Разорвать связь": первый клик - запрос подтверждения
// (кнопка становится красной "Точно?"), второй - выполняет разрыв.
// Защищает от случайного клика в плотной таблице.
const DetachButton = ({ onClick, isLoading, withLabel = false }: DetachButtonProps) => {
  const [confirming, setConfirming] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setConfirming(false);
    onClick();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isLoading}
      title="Разорвать связь — вывести запись из группы"
      className={`h-7 gap-1.5 shrink-0 ${
        confirming
          ? 'text-destructive border-destructive/40 bg-destructive/10 hover:bg-destructive/20 hover:text-destructive'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon name={isLoading ? 'Loader2' : 'Magnet'} size={12} className={isLoading ? 'animate-spin' : ''} />
      {confirming ? 'Точно?' : withLabel ? 'Разорвать связь' : null}
    </Button>
  );
};

export default DetachButton;
