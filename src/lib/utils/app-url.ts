import { headers } from 'next/headers';

/**
 * Derive the public-facing base URL from the incoming request headers.
 * Works in Vercel (uses x-forwarded-host/proto) and local dev without any
 * env var configuration. Falls back to NEXT_PUBLIC_APP_URL if headers are
 * unavailable.
 *
 * Server-only: must be called from a Server Component, Server Action, or
 * Route Handler.
 */
export async function getAppBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto =
    h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? '';
}
