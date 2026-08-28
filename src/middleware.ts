import { NextResponse, type NextRequest, type NextFetchEvent, type NextMiddleware } from 'next/server';
import { auth } from '@/lib/auth';
import { BOOKING_HOST, BOOKING_PATH_PREFIX } from '@/lib/constants/hosts';

/**
 * `auth` invocado como middleware, que es como lo usaba el `export default auth`
 * anterior. next-auth no expone esa firma en sus overloads públicos (solo las de
 * API route, RSC y wrapper), pero en runtime detecta el `Request` y toma esa
 * rama — ver `handleAuth` en next-auth/lib/index.js.
 */
const authMiddleware = auth as unknown as NextMiddleware;

/** ¿La ruta pertenece al motor de reservas? (`/book` exacto o `/book/...`) */
function isBookingEnginePath(pathname: string): boolean {
  return pathname === BOOKING_PATH_PREFIX || pathname.startsWith(`${BOOKING_PATH_PREFIX}/`);
}

/**
 * ¿Es un fichero estático servido desde public/? Se detecta por la extensión en
 * el último segmento.
 *
 * Importa porque estas rutas NO se pueden reescribir hacia /book: en el host del
 * motor, un logo en /uploads/marca/logo.svg acabaría pidiéndose como
 * /book/uploads/marca/logo.svg y devolviendo 404. Los slugs de organización y
 * los códigos de propiedad nunca llevan punto, así que no hay colisión.
 */
function isStaticFilePath(pathname: string): boolean {
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return lastSegment.includes('.');
}

/**
 * El motor de reservas se sirve desde su propio subdominio pero vive en la misma
 * app, bajo `/book/*`. Este middleware es el ÚNICO sitio que conoce esa
 * correspondencia; el resto del código enlaza siempre con el prefijo interno.
 *
 * En el host del motor:
 *   /{orgSlug}/{code}        → rewrite a /book/{orgSlug}/{code}   (sirve)
 *   /book/{orgSlug}/{code}   → redirect 308 a /{orgSlug}/{code}   (canoniza)
 *
 * El redirect es lo que evita que el prefijo interno se filtre a la barra de
 * direcciones: las páginas del motor enlazan entre sí con `/book/...`, y sin él
 * el huésped acababa en book.chamelioguest.com/book/... en cuanto navegaba.
 *
 * Tiene que ir aquí y no en `rewrites()` de next.config porque el middleware se
 * ejecuta ANTES de los rewrites: `auth` vería todavía la ruta sin prefijo, no la
 * reconocería como pública y redirigiría al login.
 */
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  const isBooking = isBookingEnginePath(pathname);

  if (req.headers.get('host') === BOOKING_HOST) {
    const url = req.nextUrl.clone();

    if (isBooking) {
      url.pathname = pathname.slice(BOOKING_PATH_PREFIX.length) || '/';
      return NextResponse.redirect(url, 308);
    }

    // Ficheros de public/ (logos de marca, widget.js…) se sirven tal cual.
    if (isStaticFilePath(pathname)) return NextResponse.next();

    // `/` en el host del motor no identifica ninguna propiedad: acaba en 404,
    // que es lo correcto (el backoffice no se expone en el dominio de huéspedes).
    url.pathname = `${BOOKING_PATH_PREFIX}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Host del PMS: el motor sigue siendo público en su ruta canónica.
  if (isBooking) return NextResponse.next();

  return authMiddleware(req, event);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next (todo lo interno del framework: estáticos, optimizador de
     *   imágenes y el socket de HMR en desarrollo, que si se reescribe hacia
     *   /book rompe el hot reload en el host del motor)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets
     * - api/auth (Auth.js routes — must be accessible unauthenticated)
     * - api/upload (file upload routes — auth handled in route handler)
     * - api/public (public booking engine API)
     * - uploads (assets subidos: logos de marca, fotos de habitaciones… son
     *   públicos por definición, los ve un huésped anónimo. Además el
     *   optimizador de imágenes los descarga sin cookie de sesión, así que tras
     *   auth recibía un 302 al login y devolvía 400.)
     * - api/v1 (integration API — authenticated by API key in the route handler)
     *
     * `/book` NO se excluye aquí: el middleware necesita verlo para canonizar la
     * URL en el host del motor. Su carácter público se resuelve arriba, en el
     * propio middleware.
     */
    '/((?!_next|favicon.ico|sitemap.xml|robots.txt|api/auth|api/public|api/upload|api/v1|uploads).*)',
  ],
};
