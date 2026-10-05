import { useEffect, useState } from 'react';
import { Banner, bannersApi } from '@/components/banners/bannerTypes';

const REFRESH_MS = 5 * 60 * 1000;

export const usePageBanners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${bannersApi}?banners=1`);
        const data = await res.json();
        if (alive && res.ok) setBanners(data.banners || []);
      } catch {
        /* баннеры не критичны - при сбое просто не показываем */
      }
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const forPage = (page: string) =>
    banners.filter((b) => (b.page === 'all' || b.page === page) && b.text.trim())
      .sort((a, b) => (a.page === 'all' ? -1 : 0) - (b.page === 'all' ? -1 : 0));

  return { forPage };
};
