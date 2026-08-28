'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { locales, type Locale } from '@/i18n/locales';

const localeSchema = z.enum(locales);

/**
 * Guarda el idioma elegido en una cookie de un año.
 *
 * La llama tanto el backoffice (sidebar) como el motor de reservas, que es
 * público: de ahí que valide la entrada en vez de fiarse del tipo.
 */
export async function setLocale(locale: Locale) {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return;

  const cookieStore = await cookies();
  cookieStore.set('locale', parsed.data, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
