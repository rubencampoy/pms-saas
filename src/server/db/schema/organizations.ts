import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Europe/Madrid'),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('EUR'),
  locale: varchar('locale', { length: 10 }).notNull().default('es-ES'),
  settings: jsonb('settings').default({}),
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
