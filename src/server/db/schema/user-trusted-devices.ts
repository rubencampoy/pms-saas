import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

/**
 * Trusted devices that may skip the 2FA step for 30 days.
 * Cookie value is hashed (sha256) — the plaintext lives only in the user's browser.
 */
export const userTrustedDevices = pgTable(
  'user_trusted_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceLabel: varchar('device_label', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('user_trusted_devices_user_id_idx').on(table.userId),
    index('user_trusted_devices_token_hash_idx').on(table.tokenHash),
  ],
);
