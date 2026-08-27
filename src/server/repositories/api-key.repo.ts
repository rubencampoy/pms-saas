import { db } from '@/server/db';
import { apiKeys, apiRequestLogs } from '@/server/db/schema';
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { ApiScope } from '@/lib/constants/api';

export const apiKeyRepo = {
  /**
   * Look up a key by its digest.
   *
   * This is the one query in the codebase that legitimately does not filter by
   * `organizationId`: it is the lookup that *resolves* the organization from an
   * opaque credential, exactly like the session lookup in Auth.js. Every query
   * made downstream of it is scoped by the `organizationId` it returns.
   */
  async findByHash(keyHash: string) {
    return db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });
  },

  async findAll(organizationId: string) {
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        propertyId: apiKeys.propertyId,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        rateLimitPerMinute: apiKeys.rateLimitPerMinute,
        // Evaluated by Postgres rather than at render time: "is this key
        // expired" is a question about *now*, and asking the database keeps
        // the answer out of an otherwise pure component render.
        isExpired: sql<boolean>`${apiKeys.expiresAt} is not null and ${apiKeys.expiresAt} <= now()`,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, organizationId))
      .orderBy(desc(apiKeys.createdAt));
  },

  /** Requests per key over the last `hours`, for the settings screen. */
  async usageWithinHours(organizationId: string, hours: number) {
    return db
      .select({
        apiKeyId: apiRequestLogs.apiKeyId,
        requests: count(),
        errors: sql<number>`count(*) filter (where ${apiRequestLogs.status} >= 400)::int`,
      })
      .from(apiRequestLogs)
      .where(
        and(
          eq(apiRequestLogs.organizationId, organizationId),
          gte(
            apiRequestLogs.createdAt,
            sql`now() - make_interval(hours => ${hours})`,
          ),
        ),
      )
      .groupBy(apiRequestLogs.apiKeyId);
  },

  async findById(organizationId: string, id: string) {
    return db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.id, id)),
      columns: { keyHash: false },
    });
  },

  async create(data: {
    organizationId: string;
    propertyId?: string | null;
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: ApiScope[];
    rateLimitPerMinute?: number;
    expiresAt?: Date | null;
    createdBy?: string | null;
  }) {
    const [created] = await db.insert(apiKeys).values(data).returning();
    return created;
  },

  async revoke(organizationId: string, id: string) {
    const [revoked] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(apiKeys.organizationId, organizationId),
          eq(apiKeys.id, id),
          isNull(apiKeys.revokedAt),
        ),
      )
      .returning({ id: apiKeys.id });
    return revoked ?? null;
  },

  /**
   * Record that a key was used. Fire-and-forget from the request path — a
   * failure here must never fail the API call it is instrumenting.
   */
  async touchLastUsed(organizationId: string, id: string) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(and(eq(apiKeys.organizationId, organizationId), eq(apiKeys.id, id)));
  },
};

export const apiRequestLogRepo = {
  async findRecent(organizationId: string, limit = 50) {
    return db
      .select({
        id: apiRequestLogs.id,
        apiKeyId: apiRequestLogs.apiKeyId,
        method: apiRequestLogs.method,
        path: apiRequestLogs.path,
        status: apiRequestLogs.status,
        errorCode: apiRequestLogs.errorCode,
        durationMs: apiRequestLogs.durationMs,
        createdAt: apiRequestLogs.createdAt,
      })
      .from(apiRequestLogs)
      .where(eq(apiRequestLogs.organizationId, organizationId))
      .orderBy(desc(apiRequestLogs.createdAt))
      .limit(limit);
  },
};
