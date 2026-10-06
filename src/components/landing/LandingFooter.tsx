import Icon from '@/components/ui/icon';

const LandingFooter = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2">
          <Icon name="Zap" size={20} className="text-primary" />
          <span className="font-display font-bold text-foreground">Сверка</span>
        </a>
        <div className="flex flex-col items-center gap-2 sm:items-end">
          <div className="flex gap-4 text-sm">
            <a href="/terms" className="text-muted-foreground hover:text-foreground">Пользовательское соглашение</a>
            <a href="/legal" className="text-muted-foreground hover:text-foreground">Политика обработки персональных данных</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Сверка. Платформа контроля 54-ФЗ.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;