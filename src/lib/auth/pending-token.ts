import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Lightweight signed token used to bridge step 1 (email+password) and
 * step 2 (TOTP / setup) of the login flow. Not a session — short-lived,
 * server-issued, server-verified, and consumed only by the Credentials
 * provider when it emits the real session.
 *
 * Format: base64url(payloadJson).base64url(hmacSha256(payload))
 */

const TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * - `setup`   — user has authenticated with password but has no TOTP yet;
 *               the payload also carries the freshly-generated secret so the
 *               enrollment screen can render a QR without persisting yet.
 * - `verify`  — user has authenticated with password and already has TOTP;
 *               step 2 still needs to validate the 6-digit code.
 * - `trusted` — pre-flight checks (password + TOTP / recovery / trusted-device)
 *               have all passed server-side. Hand-off to the Credentials
 *               provider to mint a real session.
 */
export type PendingPurpose = 'setup' | 'verify' | 'trusted';

export interface PendingPayload {
  userId: string;
  purpose: PendingPurpose;
  /** Base32 TOTP secret. Present only when purpose === 'setup'. */
  setupSecret?: string;
  /** Unix seconds */
  exp: number;
}

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be set');
  return Buffer.from(secret, 'utf8');
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return b64urlEncode(createHmac('sha256', getSecret()).update(payload).digest());
}

export function issuePendingToken(
  userId: string,
  purpose: PendingPurpose,
  extras: { setupSecret?: string } = {},
): string {
  const payload: PendingPayload = {
    userId,
    purpose,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    ...(extras.setupSecret ? { setupSecret: extras.setupSecret } : {}),
  };
  const payloadEncoded = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${payloadEncoded}.${sign(payloadEncoded)}`;
}

export function verifyPendingToken(token: string): PendingPayload | null {
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) return null;

  const expectedSig = sign(payloadEncoded);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: PendingPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadEncoded).toString('utf8')) as PendingPayload;
  } catch {
    return null;
  }

  if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null;
  if (
    payload.purpose !== 'setup' &&
    payload.purpose !== 'verify' &&
    payload.purpose !== 'trusted'
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
