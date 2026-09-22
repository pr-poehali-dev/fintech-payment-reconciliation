import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserIntegration } from './integrationsPageTypes';

interface DeleteIntegrationDialogProps {
  deletingIntegration: UserIntegration | null;
  showDeleteDialog: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const DeleteIntegrationDialog = ({
  deletingIntegration,
  showDeleteDialog,
  onOpenChange,
  onConfirm
}: DeleteIntegrationDialogProps) => {
  if (!deletingIntegration) return null;

  return (
    <AlertDialog open={showDeleteDialog} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить эту интеграцию?</AlertDialogTitle>
          <AlertDialogDescription>
            Вебхуки перестанут поступать. Интеграция <strong>{deletingIntegration.integration_name}</strong> будет удалена навсегда.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отменить</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteIntegrationDialog;
