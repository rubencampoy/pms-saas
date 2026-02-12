import { pgTable, uuid, varchar, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';

export const ratePlans = pgTable('rate_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  description: text('description'),
  cancellationPolicy: varchar('cancellation_policy', { length: 20 }).notNull().default('free'),
  cancellationHours: integer('cancellation_hours').notNull().default(24),
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
