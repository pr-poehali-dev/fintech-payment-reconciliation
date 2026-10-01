import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import functionUrls from '../../backend/func2url.json';

type Ym = ((id: number, method: string, ...args: unknown[]) => void) & { a?: unknown[]; l?: number };

declare global {
  interface Window {
    ym?: Ym;
    dataLayer?: Record<string, unknown>[];
  }
}

const api = (functionUrls as Record<string, string>)['platform-settings'];
const TAG_URL = 'https://mc.yandex.ru/metrika/tag.js';

// Счётчик Яндекс Метрики из настроек платформы: подключается при загрузке сайта,
// переходы между страницами приложения отправляются как просмотры (hit).
const YandexMetrika = () => {
  const location = useLocation();
  const counterRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(`${api}?public=1`)
      .then((r) => r.json())
      .then((data) => {
        const id = Number(data.metrika_counter_id);
        if (!id) return;
        counterRef.current = id;
        if (!window.ym) {
          const ym: Ym = (...args: unknown[]) => {
            (ym.a = ym.a || []).push(args);
          };
          ym.l = Date.now();
          window.ym = ym;
        }
        if (!Array.from(document.scripts).some((s) => s.src === TAG_URL)) {
          const script = document.createElement('script');
          script.async = true;
          script.src = TAG_URL;
          document.head.appendChild(script);
        }
        window.dataLayer = window.dataLayer || [];
        window.ym(id, 'init', {
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: true,
          ecommerce: 'dataLayer'
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (counterRef.current && window.ym) {
      window.ym(counterRef.current, 'hit', window.location.href);
    }
  }, [location.pathname, location.search]);

  return null;
};

export default YandexMetrika;
