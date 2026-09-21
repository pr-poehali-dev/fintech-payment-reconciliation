import Icon from '@/components/ui/icon';

const LandingFooter = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2">
          <Icon name="Zap" size={20} className="text-primary" />
          <span className="font-display font-bold text-foreground">Екомкасса ПРО</span>
        </a>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Екомкасса ПРО. Платформа сверки по 54-ФЗ.
        </p>
      </div>
    </footer>
  );
};

export default LandingFooter;
