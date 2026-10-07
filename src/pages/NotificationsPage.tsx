import NotificationPreferences from '@/components/settings/NotificationPreferences';

const NotificationsPage = () => (
  <div className="animate-fade-in space-y-6">
    <div>
      <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">Уведомления</h2>
      <p className="text-muted-foreground">Какие уведомления дублировать лично вам — в мессенджер или на почту</p>
    </div>
    <NotificationPreferences />
  </div>
);

export default NotificationsPage;
