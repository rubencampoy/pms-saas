import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { integrations } from './integrations';

export const airbnbHosts = pgTable(
  'airbnb_hosts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    airbnbToken: varchar('airbnb_token', { length: 128 }).notNull(),
    airbnbClientId: varchar('airbnb_client_id', { length: 255 }).notNull(),
    hostStatus: varchar('host_status', { length: 20 }).notNull().default('pending'),
    hostStatusCode: varchar('host_status_code', { length: 10 }),
    oauthCompletedAt: timestamp('oauth_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_airbnb_hosts_org_integration').on(
      table.organizationId,
      table.integrationId,
    ),
  ],
);
