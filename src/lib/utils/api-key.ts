import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  API_KEY_DISPLAY_PREFIX_LENGTH,
  API_KEY_PREFIX,
  API_KEY_SECRET_BYTES,
} from '@/lib/constants/api';

export interface GeneratedApiKey {
  /** Full secret, shown to the user exactly once. Never persisted. */
  key: string;
  /** Clear-text head stored for display. */
  keyPrefix: string;
  /** SHA-256 digest, hex encoded — what actually goes in the DB. */
  keyHash: string;
}

/**
 * Mint a new API key.
 *
 * The secret is 32 random bytes rendered base64url, i.e. 256 bits of entropy.
 * That is why a plain SHA-256 digest is the correct storage primitive here:
 * there is nothing to brute-force, and every request needs an indexed O(1)
 * lookup. Password hashes (bcrypt/argon2) exist for *low*-entropy secrets and
 * would make key verification deliberately slow for no security gain.
 */
export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(API_KEY_SECRET_BYTES).toString('base64url');
  const key = `${API_KEY_PREFIX}${secret}`;

  return {
    key,
    keyPrefix: key.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
    keyHash: hashApiKey(key),
  };
}

/** SHA-256 of a full key, hex encoded. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex digests.
 *
 * The DB lookup is by digest, so an attacker cannot learn anything from the
 * query itself, but the final equality check is compared in constant time so
 * that a partially-matching digest cannot be distinguished by timing.
 */
export function apiKeyHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Extract the bearer token from an Authorization header.
 * Returns null when the header is absent or not a well-formed bearer token.
 */
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
