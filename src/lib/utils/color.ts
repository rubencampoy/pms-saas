/**
 * Utilidades de contraste para el color de marca del motor de reservas.
 *
 * El cliente elige un color libremente, así que no podemos dar por hecho que el
 * texto blanco encima se lea: sobre un amarillo corporativo el contraste se
 * hunde. Estas funciones eligen el color de texto adecuado y permiten avisar en
 * el panel cuando la combinación no llega al mínimo de WCAG AA.
 */

/** Texto claro y oscuro que usa el motor de reservas sobre el color de marca. */
export const LIGHT_FOREGROUND = '#ffffff';
export const DARK_FOREGROUND = '#0f172a';

/** Ratio mínimo de WCAG AA para texto normal. */
export const WCAG_AA_NORMAL_TEXT = 4.5;

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match?.[1]) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** Luminancia relativa según WCAG 2.1. */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste entre dos colores hex (1 = idéntico, 21 = negro/blanco).
 * Devuelve null si alguno no es un hex de 6 dígitos válido.
 */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return null;

  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Color de texto legible sobre `background`: el que mayor contraste dé entre
 * blanco y el slate oscuro del sistema de diseño.
 */
export function readableForeground(background: string): string {
  const withLight = contrastRatio(background, LIGHT_FOREGROUND) ?? 0;
  const withDark = contrastRatio(background, DARK_FOREGROUND) ?? 0;
  return withDark > withLight ? DARK_FOREGROUND : LIGHT_FOREGROUND;
}

/** ¿El texto blanco sobre este color llega al mínimo de WCAG AA? */
export function hasReadableWhiteText(background: string): boolean {
  const ratio = contrastRatio(background, LIGHT_FOREGROUND);
  return ratio !== null && ratio >= WCAG_AA_NORMAL_TEXT;
}
