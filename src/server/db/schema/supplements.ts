import { pgTable, uuid, varchar, numeric, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';

export const supplements = pgTable('supplements', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
