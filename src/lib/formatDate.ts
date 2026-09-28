import { formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';

// Часовой пояс по умолчанию, пока настройки компании ещё не загрузились -
// у большинства клиентов сервис используется из России, Москва - самый
// частый и безопасный дефолт.
export const DEFAULT_TIMEZONE = 'Europe/Moscow';

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { value: 'UTC', label: 'UTC (без смещения)' }
];

/**
 * Форматирует дату/время из БД (хранится в UTC) в часовом поясе компании.
 * Даты с сервера приходят как ISO-строка без явного смещения (naive UTC) -
 * добавляем "Z", если её ещё нет, чтобы date-fns-tz не принял её за
 * локальное время браузера.
 */
export const formatDateTime = (
  dateStr: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  withSeconds = false
): string => {
  if (!dateStr) return '—';
  const isoUtc = /Z|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  try {
    return formatInTimeZone(
      isoUtc,
      timezone,
      withSeconds ? 'dd.MM.yyyy, HH:mm:ss' : 'dd.MM.yyyy, HH:mm',
      { locale: ru }
    );
  } catch {
    return '—';
  }
};

export const formatDateOnly = (
  dateStr: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string => {
  if (!dateStr) return '—';
  const isoUtc = /Z|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  try {
    return formatInTimeZone(isoUtc, timezone, 'dd.MM.yyyy', { locale: ru });
  } catch {
    return '—';
  }
};
