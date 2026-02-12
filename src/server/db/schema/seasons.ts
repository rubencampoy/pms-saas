import { pgTable, uuid, varchar, date, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
