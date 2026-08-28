import { describe, it, expect } from 'vitest';
import { createTranslator } from 'next-intl';
import { locales, LOCALE_NAMES, type Locale } from './locales';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import de from '../../messages/de.json';
import nl from '../../messages/nl.json';

const CATALOGS: Record<Locale, { bookingEnginePublic: Record<string, string> }> = {
  en,
  es,
  fr,
  de,
  nl,
};

/** Las claves que ve el huésped: son las que TODOS los idiomas deben cubrir. */
const publicKeys = Object.keys(en.bookingEnginePublic);

describe('mensajes del motor de reservas', () => {
  it('tiene un catálogo por cada idioma que se le ofrece al huésped', () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...locales].sort());
    for (const locale of locales) expect(LOCALE_NAMES[locale]).toBeTruthy();
  });

  it.each(locales)('%s traduce todas las claves públicas', (locale) => {
    const messages = CATALOGS[locale].bookingEnginePublic;
    const missing = publicKeys.filter((key) => !(key in messages));
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s no arrastra claves públicas que ya no existen', (locale) => {
    const stale = Object.keys(CATALOGS[locale].bookingEnginePublic).filter(
      (key) => !publicKeys.includes(key),
    );
    expect(stale).toEqual([]);
  });

  it.each(locales)('%s compila todos los mensajes ICU', (locale) => {
    const messages = CATALOGS[locale].bookingEnginePublic;
    const t = createTranslator({
      locale,
      messages,
      // Un ICU roto se reporta por aquí en vez de reventar: sin esto el mensaje
      // se sustituye por la clave y el test pasaría de largo.
      onError: (error) => {
        throw error;
      },
    });

    for (const key of Object.keys(messages)) {
      expect(() => t(key, { count: 2, email: 'a@b.com' }), `${locale}.${key}`).not.toThrow();
    }
  });

  it.each(locales)('%s pluraliza los contadores de ocupación', (locale) => {
    const t = createTranslator({ locale, messages: CATALOGS[locale].bookingEnginePublic });

    for (const key of ['guestCount', 'adultCount', 'childCount']) {
      const one = t(key, { count: 1 });
      const many = t(key, { count: 4 });
      expect(one, `${locale}.${key}`).not.toBe(many);
      expect(many, `${locale}.${key}`).toContain('4');
    }
  });
});
