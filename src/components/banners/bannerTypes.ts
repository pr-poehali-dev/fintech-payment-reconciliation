import functionUrls from '../../../backend/func2url.json';

export const bannersApi = (functionUrls as Record<string, string>)['platform-settings'];

export type BannerVariant = 'info' | 'warning' | 'danger' | 'success';

export interface Banner {
  page: string;
  text: string;
  button_text: string;
  button_url: string;
  variant: BannerVariant;
  updated_at?: string | null;
}

export interface BannerPage {
  id: string;
  name: string;
}

export const BANNER_VARIANTS: Record<BannerVariant, { label: string; icon: string; className: string; iconClass: string }> = {
  info: { label: 'Информация', icon: 'Info', className: 'border-primary/40 bg-primary/10', iconClass: 'text-primary' },
  warning: { label: 'Предупреждение', icon: 'TriangleAlert', className: 'border-amber-500/40 bg-amber-500/10', iconClass: 'text-amber-500' },
  danger: { label: 'Важно', icon: 'CircleAlert', className: 'border-destructive/50 bg-destructive/10', iconClass: 'text-destructive' },
  success: { label: 'Новость', icon: 'Sparkles', className: 'border-emerald-500/40 bg-emerald-500/10', iconClass: 'text-emerald-500' },
};
