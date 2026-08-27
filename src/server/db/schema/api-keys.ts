import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';
import { users } from './users';
import type { ApiScope } from '@/lib/constants/api';
import { RATE_LIMIT_DEFAULT_PER_MINUTE } from '@/lib/constants/api';

/**
 * Inbound API keys for the public integration API (`/api/v1`).
 *
 * Distinct from `integrations`, which stores *outbound* third-party
 * credentials (channel manager) encrypted with a reversible cipher. Here the
 * secret is never needed again after issuance, so only its SHA-256 digest is
 * stored. A plain digest — not bcrypt — is the right primitive: the secret
 * carries 256 bits of entropy, so it is not brute-forceable, and lookup must
 * be O(1) on every request.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    /** When set, the key can only read data of this single property. */
    propertyId: uuid('property_id').references(() => properties.id),
    name: varchar('name', { length: 100 }).notNull(),
    /** Clear-text head of the key (`cham_live_ab12cd`) so the UI can identify it. */
    keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
    /** SHA-256 of the full key, hex encoded. */
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    scopes: jsonb('scopes').$type<ApiScope[]>().notNull().default([]),
    /** Requests per minute allowed on the default bucket. */
    rateLimitPerMinute: integer('rate_limit_per_minute')
      .notNull()
      .default(RATE_LIMIT_DEFAULT_PER_MINUTE),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_api_keys_key_hash').on(table.keyHash),
    index('idx_api_keys_organization_id').on(table.organizationId),
  ],
);
