/**
 * Idiomas de la aplicación, en un módulo sin dependencias de servidor.
 *
 * Vive aparte de `request.ts` porque el selector de idioma del motor de
 * reservas es un componente de cliente: importar `request.ts` arrastraría
 * `next/headers` al bundle del navegador.
 */

/** Orden en el que se le ofrecen los idiomas al huésped. */
export const locales = ['es', 'en', 'fr', 'de', 'nl'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

/** Nombre de cada idioma en su propia lengua, que es como se enseña al huésped. */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  nl: 'Nederlands',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
