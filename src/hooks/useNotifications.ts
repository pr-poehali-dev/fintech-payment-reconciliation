import { useCallback, useEffect, useState } from 'react';
import functionUrls from '../../backend/func2url.json';

export interface AppNotification {
  id: number;
  kind: string;
  level: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  link_module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  read: boolean;
}

const POLL_MS = 2 * 60_000;
const api = (functionUrls as Record<string, string>)['notifications'];

export const useNotifications = (companyId?: number, userId?: number) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${api}?company_id=${companyId}&user_id=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.notifications || []);
        setUnread(data.unread || 0);
      }
    } catch {
      /* сеть недоступна - покажем при следующем опросе */
    } finally {
      setIsLoading(false);
    }
  }, [companyId, userId]);

  useEffect(() => {
    setItems([]);
    setUnread(0);
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const post = useCallback(async (body: object) => {
    if (!companyId || !userId) return;
    await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, user_id: userId, ...body })
    }).catch(() => {});
  }, [companyId, userId]);

  const markRead = useCallback(async (ids?: number[]) => {
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((prev) => (ids ? Math.max(0, prev - items.filter((n) => ids.includes(n.id) && !n.read).length) : 0));
    await post({ action: 'read', ids });
  }, [post, items]);

  const hide = useCallback(async (id: number) => {
    const target = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.read) setUnread((prev) => Math.max(0, prev - 1));
    await post({ action: 'hide', id });
  }, [post, items]);

  return { items, unread, isLoading, reload: load, markRead, hide };
};

export default useNotifications;
