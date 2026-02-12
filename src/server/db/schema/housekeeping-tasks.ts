import { pgTable, uuid, varchar, date, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';
import { units } from './units';
import { users } from './users';

export const housekeepingTasks = pgTable('housekeeping_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitId: uuid('unit_id').notNull().references(() => units.id),
  type: varchar('type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  priority: varchar('priority', { length: 10 }).notNull().default('normal'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  scheduledDate: date('scheduled_date').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
