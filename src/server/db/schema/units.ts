import { pgTable, uuid, varchar, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';
import { roomTypes } from './room-types';

export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
  name: varchar('name', { length: 50 }).notNull(),
  floor: varchar('floor', { length: 10 }),
  status: varchar('status', { length: 20 }).notNull().default('available'),
  housekeepingStatus: varchar('housekeeping_status', { length: 20 }).notNull().default('clean'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
