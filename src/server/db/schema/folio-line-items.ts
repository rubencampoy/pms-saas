import { pgTable, uuid, varchar, date, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { folios } from './folios';
import { users } from './users';

export const folioLineItems = pgTable('folio_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  folioId: uuid('folio_id').notNull().references(() => folios.id),
  type: varchar('type', { length: 20 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  date: date('date').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
