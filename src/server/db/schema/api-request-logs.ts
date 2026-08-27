import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { apiKeys } from './api-keys';

/**
 * Rate-limit counters for the public API, one row per (key, bucket, window).
 *
 * Postgres rather than Redis: there is none in this stack, and an in-process
 * counter is worthless on serverless where consecutive requests may land on
 * different instances. One upsert per request is the cost.
 *
 * Rows are disposable — old windows are pruned opportunistically when a key
 * opens a new one.
 */
export const apiKeyUsage = pgTable(
  'api_key_usage',
  {
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    bucket: varchar('bucket', { length: 20 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    requestCount: integer('request_count').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.apiKeyId, table.bucket, table.windowStart] }),
  ],
);

/**
 * One row per request to `/api/v1`, written fire-and-forget off the response
 * path. Deliberately narrow: no bodies, no headers, no query strings — just
 * enough to answer "is this integration working, and what is it doing".
 *
 * Query strings are excluded on purpose; `/reservations/lookup` carries a
 * guest's surname in one, and logs are the wrong place for that.
 *
 * This table grows without bound; see `npm run api:prune`.
 */
export const apiRequestLogs = pgTable(
  'api_request_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, {
      onDelete: 'set null',
    }),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 255 }).notNull(),
    status: integer('status').notNull(),
    errorCode: varchar('error_code', { length: 40 }),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_api_request_logs_org_created_at').on(
      table.organizationId,
      table.createdAt,
    ),
    index('idx_api_request_logs_key_created_at').on(
      table.apiKeyId,
      table.createdAt,
    ),
  ],
);
