import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Convert a UTC date to the property's local timezone for display.
 * ONLY use this in UI components.
 */
export function toLocalDisplay(
  utcDate: Date | string,
  timezone: string,
  formatStr: string = 'dd/MM/yyyy HH:mm',
): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, formatStr);
}

/**
 * Convert a local date input from the UI to UTC for storage.
 * ONLY use this in Server Actions when processing form inputs.
 */
export function toUTC(localDate: Date | string, timezone: string): Date {
  const date = typeof localDate === 'string' ? parseISO(localDate) : localDate;
  return fromZonedTime(date, timezone);
}
