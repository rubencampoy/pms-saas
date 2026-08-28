import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, type Locale } from './locales';
import englishMessages from '../../messages/en.json';

type MessageTree = { [key: string]: string | MessageTree };

/**
 * Mezcla los mensajes de un idioma sobre otro, rama a rama.
 *
 * Los idiomas que se añadieron para el motor de reservas (fr, de, nl) solo
 * traducen lo que ve el huésped; con el inglés de base, el backoffice cae a ese
 * idioma en vez de enseñar la clave cruda.
 */
function mergeMessages(base: MessageTree, override: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      typeof value === 'object' && typeof current === 'object'
        ? mergeMessages(current, value)
        : value;
  }

  return merged;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;
  const locale: Locale = isLocale(localeCookie) ? localeCookie : defaultLocale;

  const english = englishMessages as MessageTree;
  if (locale === 'en') return { locale, messages: english };

  const messages = (await import(`../../messages/${locale}.json`)).default as MessageTree;

  return { locale, messages: mergeMessages(english, messages) };
});
