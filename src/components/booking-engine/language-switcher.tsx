'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { setLocale } from '@/server/actions/locale';
import { LOCALE_NAMES, isLocale, locales, defaultLocale, type Locale } from '@/i18n/locales';

interface LanguageSwitcherProps {
  /**
   * Clases del botón cuando la cabecera va pintada con el color de marca: ahí
   * el texto hereda el foreground legible del `<header>` y el hover es un velo.
   */
  painted: boolean;
  hoverClass: string;
}

/**
 * Selector de idioma del motor de reservas.
 *
 * El idioma se guarda en la cookie `locale`, la misma que lee `i18n/request.ts`,
 * así que sobrevive a la navegación y a las siguientes visitas del huésped.
 * El desplegable NO hereda la paleta de la cabecera: sobre un color de marca
 * saturado el menú quedaría ilegible, así que va en tarjeta clara/oscura como
 * el resto de popovers del motor.
 */
export function LanguageSwitcher({ painted, hoverClass }: LanguageSwitcherProps) {
  const current = useLocale();
  const active: Locale = isLocale(current) ? current : defaultLocale;
  const [isPending, startTransition] = useTransition();

  function handleSelect(locale: Locale) {
    if (locale === active) return;
    startTransition(() => {
      setLocale(locale);
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={isPending}
          aria-label={LOCALE_NAMES[active]}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
            painted ? hoverClass : 'hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span
            className={`material-icons text-xl ${
              painted ? 'opacity-80' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            language
          </span>
          <span
            className={`text-sm font-semibold uppercase ${
              painted ? '' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {active}
          </span>
          <span
            className={`material-icons text-base ${
              painted ? 'opacity-60' : 'text-slate-400'
            }`}
          >
            expand_more
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[180px] bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-1.5"
        >
          {locales.map((locale) => (
            <DropdownMenu.Item
              key={locale}
              onSelect={() => handleSelect(locale)}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700 ${
                locale === active
                  ? 'font-semibold text-primary'
                  : 'font-medium text-slate-700 dark:text-slate-300'
              }`}
            >
              <span>{LOCALE_NAMES[locale]}</span>
              {locale === active && (
                <span className="material-icons text-base text-primary">check</span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
