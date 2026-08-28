import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { readableForeground } from '@/lib/utils/color';
import { headerLogoUrl, headerPalette } from '@/lib/utils/booking-header';
import { DEFAULT_BRAND_COLOR } from '@/lib/validators/booking-engine-settings';
import { LanguageSwitcher } from './language-switcher';
import type { BookingBranding } from '@/types/booking-engine';

/** Marca por defecto: la de Chamelio, para la página de selección de propiedad. */
export const DEFAULT_BRANDING: BookingBranding = {
  displayName: 'Chamelio',
  primaryColor: DEFAULT_BRAND_COLOR,
  logoUrl: '',
  logoInverseUrl: '',
  faviconUrl: '',
  coverImageUrl: '',
  hideChamelio: false,
  privacyUrl: '',
  termsUrl: '',
  cookiesUrl: '',
  headerStyle: 'light',
};

/** Isotipo de Chamelio, que se usa cuando el cliente no ha subido logo. */
function ChamelioMark({ className }: { className: string }) {
  return (
    <div className={`size-8 ${className}`}>
      <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function BookingEngineHeader({ branding }: { branding: BookingBranding }) {
  const palette = headerPalette(branding);
  const logoUrl = headerLogoUrl(branding, palette !== null);

  // Sobre fondo pintado el texto y los iconos heredan el color legible que se
  // fija en el <header>; el borde y los estados hover son ese mismo color con
  // alfa (los dos únicos foreground posibles son hex de 6 dígitos).
  const hoverClass = palette?.isLightText ? 'hover:bg-white/10' : 'hover:bg-black/10';
  const chipClass = palette?.isLightText ? 'bg-white/15' : 'bg-black/10';

  return (
    <header
      style={
        palette
          ? {
              backgroundColor: palette.background,
              color: palette.foreground,
              borderColor: `${palette.foreground}26`,
            }
          : undefined
      }
      className={`border-b sticky top-0 z-50 ${
        palette
          ? ''
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo del cliente, o el de Chamelio si no ha subido ninguno */}
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <span className="relative block h-10 w-40 flex-shrink-0">
                <Image
                  src={logoUrl}
                  alt={branding.displayName}
                  fill
                  unoptimized
                  priority
                  className="object-contain object-left"
                />
              </span>
            ) : (
              <>
                <ChamelioMark className={palette ? 'text-current' : 'text-primary'} />
                <span
                  className={`text-xl font-extrabold tracking-tight truncate ${
                    palette ? '' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {branding.displayName}
                </span>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-6">
            <LanguageSwitcher painted={palette !== null} hoverClass={hoverClass} />
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                palette ? chipClass : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <span
                className={`material-icons ${
                  palette ? '' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                person
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

async function BookingEngineFooter({ branding }: { branding: BookingBranding }) {
  const t = await getTranslations('bookingEnginePublic');

  // Solo se enseñan los enlaces que el cliente haya rellenado: antes apuntaban
  // todos a "#", que para el huésped es un enlace roto.
  const links = [
    { href: branding.privacyUrl, label: t('privacyPolicy') },
    { href: branding.termsUrl, label: t('termsOfService') },
    { href: branding.cookiesUrl, label: t('cookies') },
  ].filter((link) => link.href !== '');

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 py-8 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 text-center">
        {links.length > 0 && (
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 mb-4 text-sm font-medium">
            {links.map((link, index) => (
              <span key={link.href} className="contents">
                {index > 0 && (
                  <span className="hidden md:inline text-slate-300 dark:text-slate-700">
                    &bull;
                  </span>
                )}
                <a
                  className="text-slate-500 hover:text-primary transition-colors"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </div>
        )}
        <p className="text-slate-400 text-xs">
          &copy; {new Date().getFullYear()} {branding.displayName}.{' '}
          {t('allRightsReserved')}
        </p>
        {!branding.hideChamelio && (
          <p className="text-slate-400 text-xs mt-1">{t('poweredBy')}</p>
        )}
      </div>
    </footer>
  );
}

interface BookingChromeProps {
  branding: BookingBranding;
  children: React.ReactNode;
}

/**
 * Cabecera, pie y tema del motor de reservas público.
 *
 * El color de marca se inyecta como `--color-primary` en el contenedor: las
 * utilidades `bg-primary`/`text-primary` compilan a `var(--color-primary)`
 * (ver el `@theme` no inline de globals.css), así que todo lo que hay dentro se
 * repinta sin tocar ni un componente. `--color-primary-foreground` acompaña con
 * un texto legible encima, calculado por contraste.
 */
export function BookingChrome({ branding, children }: BookingChromeProps) {
  const themeVars = {
    '--color-primary': branding.primaryColor,
    '--color-primary-foreground': readableForeground(branding.primaryColor),
  } as React.CSSProperties;

  return (
    <div
      style={themeVars}
      className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col"
    >
      <BookingEngineHeader branding={branding} />
      <main className="flex-grow">{children}</main>
      <BookingEngineFooter branding={branding} />
    </div>
  );
}
