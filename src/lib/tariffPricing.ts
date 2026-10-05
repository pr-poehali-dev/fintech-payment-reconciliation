import { pluralDays } from '@/lib/trialDays';

// Сколько оплачиваемых периодов тарифа в году: 30 дней = 12 платежей, иначе по дням.
export const periodsPerYear = (periodDays?: number) => {
  const days = periodDays && periodDays > 0 ? periodDays : 30;
  return days === 30 ? 12 : 365 / days;
};

export const fullYearPrice = (price: number, periodDays?: number) => price * periodsPerYear(periodDays);

export const discountedYearPrice = (price: number, periodDays?: number, discount = 0) =>
  Math.round(fullYearPrice(price, periodDays) * (1 - discount / 100));

// «/ мес» для 30 дней, иначе «/ 7 дней».
export const periodLabel = (periodDays?: number) =>
  !periodDays || periodDays === 30 ? 'мес' : pluralDays(periodDays);
