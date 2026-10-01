import { useEffect } from 'react';
import functionUrls from '../../backend/func2url.json';

const INTERVAL_MS = 60_000;

// В платформе нет планировщика: пока открыт кабинет, раз в минуту будим
// обработчик автоматизации - он запустит задания, у которых подошло время
// повтора, и подхватит зависшие «в работе». Повторы есть и без этого
// (по любому новому уведомлению от банка/кассы), здесь - страховка.
export const useAutomationHeartbeat = (companyId?: number) => {
  useEffect(() => {
    if (!companyId) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(functionUrls['automation-jobs'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', company_id: companyId })
      }).catch(() => {});
    };
    const id = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [companyId]);
};

export default useAutomationHeartbeat;
