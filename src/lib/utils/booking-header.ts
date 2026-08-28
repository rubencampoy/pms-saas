import { LIGHT_FOREGROUND, readableForeground } from '@/lib/utils/color';
import type { BookingBranding } from '@/types/booking-engine';

/**
 * Colores del logo y la cabecera del motor de reservas.
 *
 * Vive aparte del chrome porque el panel de ajustes —un componente de
 * cliente— pinta la misma cabecera en su vista previa, y el chrome arrastra
 * `next-intl/server`.
 */

/** Slate 900: el fondo de la cabecera oscura, el mismo que usa el sistema. */
export const DARK_HEADER_BACKGROUND = '#0f172a';

export interface HeaderPalette {
  background: string;
  foreground: string;
  /** El foreground es blanco, así que los velos van en blanco y no en negro. */
  isLightText: boolean;
}

/**
 * Colores de la cabecera cuando el cliente la pinta. Devuelve `null` para el
 * estilo claro, que se queda con las clases de Tailwind de toda la vida (y con
 * su modo oscuro).
 */
export function headerPalette(
  branding: Pick<BookingBranding, 'headerStyle' | 'primaryColor'>,
): HeaderPalette | null {
  if (branding.headerStyle === 'brand') {
    const foreground = readableForeground(branding.primaryColor);
    return {
      background: branding.primaryColor,
      foreground,
      isLightText: foreground === LIGHT_FOREGROUND,
    };
  }
  if (branding.headerStyle === 'dark') {
    return {
      background: DARK_HEADER_BACKGROUND,
      foreground: LIGHT_FOREGROUND,
      isLightText: true,
    };
  }
  return null;
}

/**
 * Logo que toca en la cabecera. Sobre un fondo pintado el logo normal —tinta
 * oscura sobre blanco— desaparece, así que manda la variante inversa si el
 * cliente la ha subido.
 */
export function headerLogoUrl(
  branding: Pick<BookingBranding, 'logoUrl' | 'logoInverseUrl'>,
  painted: boolean,
): string {
  return painted && branding.logoInverseUrl ? branding.logoInverseUrl : branding.logoUrl;
}
