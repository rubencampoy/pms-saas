/**
 * Constants for the public integration API (`/api/v1`).
 *
 * This surface is consumed machine-to-machine by external products (the
 * Chamelio guest-app, and any future integration) using an organization API
 * key. It is intentionally read-only.
 */

/** Scopes an API key can be granted. Read-only by design — see docs/integrations/GUEST_APP_API.md */
export enum ApiScope {
  PROPERTIES_READ = 'properties:read',
  ROOM_TYPES_READ = 'room_types:read',
  RESERVATIONS_READ = 'reservations:read',
  GUESTS_READ = 'guests:read',
  FOLIOS_READ = 'folios:read',
  AVAILABILITY_READ = 'availability:read',
}

export const API_SCOPES = [
  ApiScope.PROPERTIES_READ,
  ApiScope.ROOM_TYPES_READ,
  ApiScope.RESERVATIONS_READ,
  ApiScope.GUESTS_READ,
  ApiScope.FOLIOS_READ,
  ApiScope.AVAILABILITY_READ,
] as const;

/** Prefix every issued key carries. Also stored in clear so the UI can show it. */
export const API_KEY_PREFIX = 'cham_live_';

/** Bytes of entropy in the secret portion of a key. */
export const API_KEY_SECRET_BYTES = 32;

/** Characters of a key stored in clear for display (`cham_live_` + 6 chars). */
export const API_KEY_DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 6;

/** Pagination defaults for list endpoints. */
export const API_PAGE_SIZE_DEFAULT = 50;
export const API_PAGE_SIZE_MAX = 200;

/**
 * Rate limiting. A fixed one-minute window per key, counted in Postgres —
 * there is no Redis in this stack and an in-memory counter is useless on
 * serverless, where every request may land on a fresh instance.
 */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Default budget for a new key, overridable per key. */
export const RATE_LIMIT_DEFAULT_PER_MINUTE = 120;
export const RATE_LIMIT_MIN_PER_MINUTE = 1;
export const RATE_LIMIT_MAX_PER_MINUTE = 6000;

/**
 * Buckets are counted separately, so a burst of ordinary reads cannot exhaust
 * the allowance that protects the identification endpoint — and vice versa.
 */
export const RateLimitBucket = {
  DEFAULT: 'default',
  /**
   * `/reservations/lookup` guesses at a confirmation code plus a surname.
   * A far tighter budget is what makes brute-forcing that pair impractical,
   * so this one is fixed rather than configurable per key.
   */
  LOOKUP: 'lookup',
} as const;

export type RateLimitBucketValue =
  (typeof RateLimitBucket)[keyof typeof RateLimitBucket];

export const RATE_LIMIT_LOOKUP_PER_MINUTE = 10;

/** Machine-readable error codes returned in `{ error: { code } }`. */
export const ApiErrorCode = {
  MISSING_CREDENTIALS: 'missing_credentials',
  INVALID_API_KEY: 'invalid_api_key',
  KEY_REVOKED: 'key_revoked',
  KEY_EXPIRED: 'key_expired',
  ORGANIZATION_SUSPENDED: 'organization_suspended',
  INSUFFICIENT_SCOPE: 'insufficient_scope',
  INVALID_REQUEST: 'invalid_request',
  RATE_LIMITED: 'rate_limited',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
