import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { apiKeyUsage } from '@/server/db/schema';
import {
  RATE_LIMIT_WINDOW_SECONDS,
  type RateLimitBucketValue,
} from '@/lib/constants/api';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds at which the current window ends. */
  resetAt: number;
  /** Seconds until the window ends, for `Retry-After`. */
  retryAfter: number;
}

/**
 * Fixed-window counter, one row per (key, bucket, window).
 *
 * A fixed window lets through up to 2× the limit across a window boundary,
 * which a sliding window would not. That is an accepted trade: this exists to
 * stop runaway clients and brute-force loops, not to meter billing, and it
 * costs a single upsert instead of the row-per-request a sliding log needs.
 *
 * The count is incremented *before* the decision, so requests that get 429'd
 * still count — a client that ignores the limit does not get a free retry.
 */
export async function consumeRateLimit(
  apiKeyId: string,
  bucket: RateLimitBucketValue,
  limit: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const resetAt = Math.floor((windowStart.getTime() + windowMs) / 1000);

  const [row] = await db
    .insert(apiKeyUsage)
    .values({ apiKeyId, bucket, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: [apiKeyUsage.apiKeyId, apiKeyUsage.bucket, apiKeyUsage.windowStart],
      set: { requestCount: sql`${apiKeyUsage.requestCount} + 1` },
    })
    .returning({ count: apiKeyUsage.requestCount });

  const count = row?.count ?? 1;

  // Opening a new window means every older one for this key is dead weight.
  // Pruning here keeps the table bounded without a scheduled job.
  if (count === 1) {
    void pruneOldWindows(apiKeyId, windowStart);
  }

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfter: Math.max(1, resetAt - Math.floor(now / 1000)),
  };
}

/** Headers every `/api/v1` response carries, so clients can self-pace. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
}

async function pruneOldWindows(apiKeyId: string, windowStart: Date) {
  try {
    await db
      .delete(apiKeyUsage)
      .where(
        sql`${apiKeyUsage.apiKeyId} = ${apiKeyId} AND ${apiKeyUsage.windowStart} < ${windowStart}`,
      );
  } catch (error) {
    // Housekeeping must never fail the request that triggered it.
    console.error('[API v1] Failed to prune rate-limit windows:', error);
  }
}
