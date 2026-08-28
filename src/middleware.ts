import { NextResponse, type NextRequest, type NextFetchEvent, type NextMiddleware } from 'next/server';
import { auth } from '@/lib/auth';
import { BOOKING_HOST, BOOKING_PATH_PREFIX } from '@/lib/constants/hosts';

/**
 * El motor de reservas se sirve desde su propio subdominio pero vive en la
 * misma app, bajo `/book/*`. Aquí se traduce una cosa en la otra.
 *
 * Tiene que hacerse en el middleware —y no con `rewrites()` en next.config—
 * porque el middleware se ejecuta ANTES de los rewrites: si no, `auth` vería
 * todavía la ruta sin prefijo (`/koala-hostel/KHE`), no la reconocería como
 * pública y redirigiría al login.
 */
function rewriteToBookingEngine(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  // `/` en el host del motor no identifica ninguna propiedad: cae en un 404,
  // que es lo correcto (el backoffice no se expone en el dominio de huéspedes).
  url.pathname = `${BOOKING_PATH_PREFIX}${url.pathname === '/' ? '' : url.pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * `auth` invocado como middleware, que es como lo usaba el `export default auth`
 * anterior. next-auth no expone esa firma en sus overloads públicos (solo las de
 * API route, RSC y wrapper), pero en runtime detecta el `Request` y toma esa
 * rama — ver `handleAuth` en next-auth/lib/index.js.
 */
const authMiddleware = auth as unknown as NextMiddleware;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const host = req.headers.get('host');

  if (host === BOOKING_HOST) {
    if (req.nextUrl.pathname.startsWith(BOOKING_PATH_PREFIX)) {
      return NextResponse.next();
    }
    return rewriteToBookingEngine(req);
  }

  return authMiddleware(req, event);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets
     * - api/auth (Auth.js routes — must be accessible unauthenticated)
     * - api/upload (file upload routes — auth handled in route handler)
     * - api/public, book (public booking engine routes)
     * - api/v1 (integration API — authenticated by API key in the route handler)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/auth|api/public|api/upload|api/v1|book).*)',
  ],
};
