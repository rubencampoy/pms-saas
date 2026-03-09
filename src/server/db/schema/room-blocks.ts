import { pgTable, uuid, varchar, text, date, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';
import { units } from './units';
import { users } from './users';

/**
 * Room Blocks — Maintenance, out-of-order, owner use, date blocks.
 * Acts like a reservation for a unit but without a guest.
 * Blocks the unit from being booked for the given date range.
 */
export const roomBlocks = pgTable('room_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitId: uuid('unit_id').notNull().references(() => units.id),
  type: varchar('type', { length: 20 }).notNull(), // 'maintenance' | 'blocked'
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
