export interface Provider {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  description: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  providers: Provider[];
}

export interface UserIntegration {
  id: number;
  integration_name: string;
  webhook_token: string;
  status: string;
  webhook_count: number;
  last_webhook_at: string | null;
  last_synced_at?: string | null;
  sync_interval_hours?: number | null;
  created_at: string;
  provider_name: string;
  provider_slug: string;
  category_slug: string;
  provider_id: number;
  config: any;
  webhook_settings: any;
  forward_url?: string;
}

export const PURPOSE_CATEGORY_LABELS: Record<string, string> = {
  acquiring_online: 'Интернет-эквайринг',
  acquiring_offline: 'Торговый эквайринг',
  individual_direct: 'От физлиц напрямую'
};
