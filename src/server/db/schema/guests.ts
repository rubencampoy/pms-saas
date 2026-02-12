import { pgTable, uuid, varchar, text, date, jsonb, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  documentType: varchar('document_type', { length: 20 }),
  documentNumber: varchar('document_number', { length: 50 }),
  nationality: varchar('nationality', { length: 2 }),
  dateOfBirth: date('date_of_birth'),
  address: jsonb('address'),
  vipStatus: varchar('vip_status', { length: 20 }).notNull().default('none'),
  notes: text('notes'),
  totalStays: integer('total_stays').notNull().default(0),
  totalRevenue: numeric('total_revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
