import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Invite {
  id: number;
  phone: string;
  email: string | null;
  full_name: string | null;
  channel: string;
  role_slug: string;
  role_name: string;
  role_color: string;
  created_at: string | null;
  expires_at: string | null;
}

interface PendingInvitesTableProps {
  invites: Invite[];
  onCancel: (inviteId: number) => void;
}

const channelLabels: Record<string, { icon: string; label: string }> = {
  telegram: { icon: 'Send', label: 'Telegram' },
  whatsapp: { icon: 'MessageCircle', label: 'WhatsApp' },
  max: { icon: 'MessageSquare', label: 'Max' },
  email: { icon: 'Mail', label: 'Email' },
};

const PendingInvitesTable = ({ invites, onCancel }: PendingInvitesTableProps) => {
  if (invites.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Кандидат</TableHead>
          <TableHead>Роль</TableHead>
          <TableHead>Отправлено через</TableHead>
          <TableHead>Действует до</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => {
          const channel = channelLabels[invite.channel] || channelLabels.telegram;
          return (
            <TableRow key={invite.id}>
              <TableCell>
                <div className="font-medium">{invite.full_name || invite.phone}</div>
                <div className="text-xs text-muted-foreground">{invite.phone}</div>
              </TableCell>
              <TableCell>
                <Badge className={`${invite.role_color} text-white`}>
                  {invite.role_name}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name={channel.icon as any} size={14} />
                  {channel.label}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString('ru-RU') : '-'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onCancel(invite.id)}>
                  <Icon name="X" size={16} className="text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default PendingInvitesTable;
