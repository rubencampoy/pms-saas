/**
 * Hosts públicos de la plataforma.
 *
 * El backoffice (PMS) y el motor de reservas guest-facing son la misma
 * aplicación Next. El motor vive bajo `/book/*`, y el subdominio propio se
 * mapea en `src/middleware.ts` con un rewrite por host:
 *
 *   book.chamelioguest.com/{orgSlug}/{propertyCode}
 *     → /book/{orgSlug}/{propertyCode}
 *
 * Son `NEXT_PUBLIC_*` porque el valor se necesita también en el cliente (para
 * componer las URLs que se muestran en Ajustes → Motor de reservas).
 */

/** Host del backoffice, sin protocolo. */
export const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? 'pms.chamelioguest.com';

/** Host guest-facing del motor de reservas, sin protocolo. */
export const BOOKING_HOST = process.env.NEXT_PUBLIC_BOOKING_HOST ?? 'book.chamelioguest.com';

/** Prefijo de ruta interno del motor de reservas. */
export const BOOKING_PATH_PREFIX = '/book';
