import { NextRequest } from 'next/server';
import { db } from '@/server/db';
import { organizations } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  apiKeyHashEquals,
  extractBearerToken,
  hashApiKey,
} from '@/lib/utils/api-key';
import { apiKeyRepo } from '@/server/repositories/api-key.repo';
import {
  ApiErrorCode,
  RateLimitBucket,
  RATE_LIMIT_LOOKUP_PER_MINUTE,
  type ApiScope,
  type RateLimitBucketValue,
} from '@/lib/constants/api';
import { apiError, apiInternalError } from './response';
import { consumeRateLimit, rateLimitHeaders } from './rate-limit';
import { logApiRequest, readErrorCode } from './request-log';

/**
 * Everything a `/api/v1` handler is allowed to know about its caller.
 *
 * `organizationId` is the tenant boundary: it must be threaded into every
 * repository call the handler makes (Golden Rule #1). `propertyId`, when
 * present, narrows the key further and handlers must honour it.
 */
export interface ApiContext {
  apiKeyId: string;
  organizationId: string;
  propertyId: string | null;
  scopes: ApiScope[];
}

/**
 * Assert an *additional* scope beyond the one the route already required.
 *
 * Expanding a response (`?include=guest`) reads data the base scope does not
 * cover, so the extra scope is checked at the point of expansion rather than
 * being folded into the route's requirement — a key that only reads
 * reservations keeps working, it just cannot expand.
 *
 * Returns a 403 response to hand back, or null when the scope is present.
 */
export function requireScope(
  context: ApiContext,
  scope: ApiScope,
): Response | null {
  if (context.scopes.includes(scope)) return null;
  return apiError(
    ApiErrorCode.INSUFFICIENT_SCOPE,
    `This API key is missing the '${scope}' scope`,
    403,
  );
}

type ApiHandler<TParams> = (
  request: NextRequest,
  context: ApiContext,
  params: TParams,
) => Promise<Response>;

interface ApiHandlerOptions {
  /**
   * Which rate-limit budget this route draws on. Defaults to the shared one;
   * `lookup` is the tighter budget that protects guest identification.
   */
  bucket?: RateLimitBucketValue;
}

/** Don't write to the DB on every single request just to track usage. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Wrap a route handler with API-key authentication, scope enforcement,
 * per-key rate limiting and request logging.
 *
 * Usage:
 * ```ts
 * export const GET = withApiKey(ApiScope.RESERVATIONS_READ, async (req, ctx) => { ... });
 * ```
 */
export function withApiKey<TParams = unknown>(
  requiredScope: ApiScope,
  handler: ApiHandler<TParams>,
  options: ApiHandlerOptions = {},
) {
  const bucket = options.bucket ?? RateLimitBucket.DEFAULT;

  return async (
    request: NextRequest,
    routeContext?: { params: Promise<TParams> },
  ): Promise<Response> => {
    const startedAt = Date.now();
    const path = request.nextUrl.pathname;

    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      // Nothing to attribute an unauthenticated request to, so it is neither
      // rate limited nor logged. Guessing a 256-bit key is not a viable
      // attack, so there is nothing here worth throttling per-IP.
      return apiError(
        ApiErrorCode.MISSING_CREDENTIALS,
        'Provide an API key as `Authorization: Bearer <key>`',
        401,
      );
    }

    // Typed as the resolved record so the rate limit is readable here; the
    // handler signature only ever exposes the narrower `ApiContext`.
    let context: ResolvedContext;
    try {
      const resolved = await resolveApiKey(token);
      if ('error' in resolved) return resolved.error;
      context = resolved.context;
    } catch (error) {
      console.error('[API v1] Key resolution failed:', error);
      return apiInternalError();
    }

    const finish = async (response: Response): Promise<Response> => {
      logApiRequest({
        organizationId: context.organizationId,
        apiKeyId: context.apiKeyId,
        method: request.method,
        path,
        status: response.status,
        errorCode: await readErrorCode(response),
        durationMs: Date.now() - startedAt,
      });
      return response;
    };

    // Rate limit before doing any work, but after identifying the key — the
    // budget belongs to the key, and a 429 should cost as little as possible.
    let limit;
    try {
      limit = await consumeRateLimit(
        context.apiKeyId,
        bucket,
        bucket === RateLimitBucket.LOOKUP
          ? RATE_LIMIT_LOOKUP_PER_MINUTE
          : context.rateLimitPerMinute,
      );
    } catch (error) {
      // Fail open: a broken counter must not take the whole API down.
      console.error('[API v1] Rate limit check failed:', error);
      limit = null;
    }

    if (limit && !limit.allowed) {
      const response = apiError(
        ApiErrorCode.RATE_LIMITED,
        `Rate limit of ${limit.limit} requests per minute exceeded`,
        429,
      );
      applyHeaders(response, {
        ...rateLimitHeaders(limit),
        'Retry-After': String(limit.retryAfter),
      });
      return finish(response);
    }

    if (!context.scopes.includes(requiredScope)) {
      const response = apiError(
        ApiErrorCode.INSUFFICIENT_SCOPE,
        `This API key is missing the '${requiredScope}' scope`,
        403,
      );
      if (limit) applyHeaders(response, rateLimitHeaders(limit));
      return finish(response);
    }

    let response: Response;
    try {
      const params = ((await routeContext?.params) ?? {}) as TParams;
      response = await handler(request, context, params);
    } catch (error) {
      console.error('[API v1] Unhandled handler error:', error);
      response = apiInternalError();
    }

    if (limit) applyHeaders(response, rateLimitHeaders(limit));
    return finish(response);
  };
}

function applyHeaders(response: Response, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

type ResolvedContext = ApiContext & { rateLimitPerMinute: number };
type ResolveResult = { context: ResolvedContext } | { error: Response };

async function resolveApiKey(token: string): Promise<ResolveResult> {
  const providedHash = hashApiKey(token);
  const record = await apiKeyRepo.findByHash(providedHash);

  // Identical response for "no such key" and "wrong key" — never let the
  // caller distinguish the two.
  if (!record || !apiKeyHashEquals(record.keyHash, providedHash)) {
    return {
      error: apiError(ApiErrorCode.INVALID_API_KEY, 'Invalid API key', 401),
    };
  }

  if (record.revokedAt) {
    return {
      error: apiError(
        ApiErrorCode.KEY_REVOKED,
        'This API key has been revoked',
        401,
      ),
    };
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return {
      error: apiError(ApiErrorCode.KEY_EXPIRED, 'This API key has expired', 401),
    };
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, record.organizationId),
    columns: { id: true, status: true },
  });

  if (!organization || organization.status !== 'active') {
    return {
      error: apiError(
        ApiErrorCode.ORGANIZATION_SUSPENDED,
        'This organization is not active',
        403,
      ),
    };
  }

  void touchLastUsed(record.organizationId, record.id, record.lastUsedAt);

  return {
    context: {
      apiKeyId: record.id,
      organizationId: record.organizationId,
      propertyId: record.propertyId,
      scopes: record.scopes,
      rateLimitPerMinute: record.rateLimitPerMinute,
    },
  };
}

async function touchLastUsed(
  organizationId: string,
  id: string,
  lastUsedAt: Date | null,
) {
  if (lastUsedAt && Date.now() - lastUsedAt.getTime() < LAST_USED_THROTTLE_MS) {
    return;
  }
  try {
    await apiKeyRepo.touchLastUsed(organizationId, id);
  } catch (error) {
    // Usage tracking must never break the request it is instrumenting.
    console.error('[API v1] Failed to record key usage:', error);
  }
}
