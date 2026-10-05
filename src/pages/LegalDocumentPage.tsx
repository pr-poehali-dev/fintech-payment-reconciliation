import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import LandingFooter from '@/components/landing/LandingFooter';
import { LegalSection, PRIVACY_POLICY, TERMS } from '@/content/legalDocuments';

const DOCUMENTS: Record<'terms' | 'privacy', { title: string; sections: LegalSection[] }> = {
  terms: { title: 'Пользовательское соглашение', sections: TERMS },
  privacy: { title: 'Политика в отношении обработки персональных данных', sections: PRIVACY_POLICY }
};

const LegalDocumentPage = ({ doc }: { doc: 'terms' | 'privacy' }) => {
  const { title, sections } = DOCUMENTS[doc];

  useEffect(() => {
    document.title = `${title} — Сверка`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Icon name="Zap" size={22} className="text-primary" />
            <span className="font-display text-lg font-bold text-foreground">Сверка</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/terms" className={doc === 'terms' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>
              Соглашение
            </Link>
            <Link to="/legal" className={doc === 'privacy' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>
              Политика ПДн
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-2 text-sm text-muted-foreground">Документы</div>
        <h1 className="mb-8 font-display text-3xl font-bold text-foreground">{title}</h1>
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="mb-3 text-lg font-semibold text-foreground">{s.title}</h2>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {s.items.map((item, i) => (
                  <p key={i}>{item}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default LegalDocumentPage;
