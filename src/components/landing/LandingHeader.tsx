import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

const NAV_LINKS = [
  { href: '#features', label: 'Возможности' },
  { href: '#how-it-works', label: 'Как это работает' },
  { href: '#pricing', label: 'Тарифы' }
];

const LandingHeader = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <Icon name="Zap" size={24} className="text-primary" />
          <span className="text-lg font-display font-bold text-foreground">Екомкасса ПРО</span>
        </a>

        <nav className="hidden md:flex items-center">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{ marginRight: '2rem' }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Войти
          </Button>
          <Button onClick={onCtaClick} className="gap-2">
            Попробовать 7 дней бесплатно
          </Button>
        </div>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Открыть меню"
        >
          <Icon name={menuOpen ? 'X' : 'Menu'} size={24} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-4 animate-fade-in">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/login')}>
              Войти
            </Button>
            <Button onClick={onCtaClick}>
              Попробовать 7 дней бесплатно
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingHeader;