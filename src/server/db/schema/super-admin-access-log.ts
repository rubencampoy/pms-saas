import { pgTable, uuid, varchar, timestamp, text, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const superAdminAccessLog = pgTable(
  'super_admin_access_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    superAdminUserId: uuid('super_admin_user_id')
      .notNull()
      .references(() => users.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 50 }).notNull(),
    reason: text('reason'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    superAdminIdx: index('idx_super_admin_log_user').on(table.superAdminUserId),
    orgIdx: index('idx_super_admin_log_org').on(table.organizationId),
    createdAtIdx: index('idx_super_admin_log_created').on(table.createdAt),
  }),
);
