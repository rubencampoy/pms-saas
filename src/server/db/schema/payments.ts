import { pgTable, uuid, varchar, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { folios } from './folios';
import { users } from './users';

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  folioId: uuid('folio_id').notNull().references(() => folios.id),
  method: varchar('method', { length: 20 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 100 }),
  notes: text('notes'),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  processedBy: uuid('processed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
