import functionUrls from '../../backend/func2url.json';

const THROTTLE_MS = 2 * 60_000;
const lastRun = new Map<number, number>();

// Дозагрузка чеков шлюза Екомкассы для платежей, чек которых не был пробит на
// момент вебхука. Раньше запускалась при каждом открытии «Сверки», «Событий» и
// «Транзакций» - теперь не чаще раза в 2 минуты на компанию.
// Returns: true, если что-то довязалось и данные стоит перезагрузить.
export const resyncGateway = async (companyId: number): Promise<boolean> => {
  const now = Date.now();
  if (now - (lastRun.get(companyId) ?? 0) < THROTTLE_MS) return false;
  lastRun.set(companyId, now);
  try {
    const res = await fetch(functionUrls['ecomkassa-gateway-resync'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId })
    });
    const data = await res.json();
    return data.resolved > 0;
  } catch {
    return false;
  }
};
