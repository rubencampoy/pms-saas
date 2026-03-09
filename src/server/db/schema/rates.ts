import { pgTable, uuid, varchar, date, numeric, integer, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { ratePlans } from './rate-plans';
import { roomTypes } from './room-types';

export const rates = pgTable('rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  ratePlanId: uuid('rate_plan_id').notNull().references(() => ratePlans.id),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  minStay: integer('min_stay').notNull().default(1),
  maxStay: integer('max_stay'),
  closedToArrival: boolean('closed_to_arrival').notNull().default(false),
  closedToDeparture: boolean('closed_to_departure').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_rates_org_plan_room_date').on(
      table.organizationId,
      table.ratePlanId,
      table.roomTypeId,
      table.date,
    ),
  ],
);
