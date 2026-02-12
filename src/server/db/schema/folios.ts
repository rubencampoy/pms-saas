import { pgTable, uuid, varchar, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { reservations } from './reservations';
import { guests } from './guests';

export const folios = pgTable('folios', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id),
  guestId: uuid('guest_id').notNull().references(() => guests.id),
  folioNumber: varchar('folio_number', { length: 30 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  taxTotal: numeric('tax_total', { precision: 10, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
  paidAmount: numeric('paid_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  notes: text('notes'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
