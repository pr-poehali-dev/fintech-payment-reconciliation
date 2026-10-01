// «7 дней», «1 день», «2 дня» - срок пробного периода для текстов лендинга.
export const DEFAULT_TRIAL_DAYS = 7;

export const pluralDays = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
  return `${n} дней`;
};
