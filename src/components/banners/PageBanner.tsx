import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Banner, BANNER_VARIANTS } from './bannerTypes';

interface PageBannerProps {
  banner: Banner;
}

const PageBanner = ({ banner }: PageBannerProps) => {
  if (!banner.text.trim()) return null;
  const style = BANNER_VARIANTS[banner.variant] ?? BANNER_VARIANTS.info;
  const external = /^https?:\/\//.test(banner.button_url);

  return (
    <div className={`mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${style.className}`}>
      <Icon name={style.icon} fallback="Info" size={22} className={`shrink-0 ${style.iconClass}`} />
      <p className="flex-1 whitespace-pre-line text-sm text-foreground">{banner.text}</p>
      {banner.button_text && banner.button_url && (
        <Button asChild size="sm" className="shrink-0">
          <a href={banner.button_url} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
            {banner.button_text}
            {external && <Icon name="ExternalLink" size={14} className="ml-1.5" />}
          </a>
        </Button>
      )}
    </div>
  );
};

export default PageBanner;
