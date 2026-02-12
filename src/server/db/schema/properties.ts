import { pgTable, uuid, varchar, time, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  address: jsonb('address').default({}),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  checkInTime: time('check_in_time').notNull().default('14:00'),
  checkOutTime: time('check_out_time').notNull().default('11:00'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Europe/Madrid'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
