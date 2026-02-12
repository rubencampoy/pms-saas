import { pgTable, uuid, varchar, text, date, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';
import { roomTypes } from './room-types';
import { units } from './units';
import { guests } from './guests';

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  confirmationCode: varchar('confirmation_code', { length: 30 }).notNull().unique(),
  guestId: uuid('guest_id').notNull().references(() => guests.id),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
  unitId: uuid('unit_id').references(() => units.id),
  status: varchar('status', { length: 20 }).notNull().default('confirmed'),
  source: varchar('source', { length: 20 }).notNull().default('direct'),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  nights: integer('nights').notNull(),
  adults: integer('adults').notNull().default(1),
  children: integer('children').notNull().default(0),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  specialRequests: text('special_requests'),
  internalNotes: text('internal_notes'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
