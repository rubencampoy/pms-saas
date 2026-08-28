import { enUS, es, fr, de, nl } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import { defaultLocale, isLocale, type Locale } from '@/i18n/locales';

/**
 * El locale de date-fns que toca para cada idioma de la aplicación.
 *
 * date-fns no acepta el código a secas: hay que darle el objeto, así que la
 * correspondencia vive aquí y no repartida por los componentes.
 */
const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = {
  es,
  en: enUS,
  fr,
  de,
  nl,
};

export function dateFnsLocale(locale: string): DateFnsLocale {
  return DATE_FNS_LOCALES[isLocale(locale) ? locale : defaultLocale];
}
