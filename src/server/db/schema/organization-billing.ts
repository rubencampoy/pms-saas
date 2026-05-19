import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const organizationBilling = pgTable(
  'organization_billing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    legalName: varchar('legal_name', { length: 255 }),
    taxId: varchar('tax_id', { length: 40 }),
    addressLine1: varchar('address_line1', { length: 255 }),
    addressLine2: varchar('address_line2', { length: 255 }),
    postalCode: varchar('postal_code', { length: 20 }),
    city: varchar('city', { length: 120 }),
    state: varchar('state', { length: 120 }),
    country: varchar('country', { length: 2 }).notNull().default('ES'),
    billingEmail: varchar('billing_email', { length: 255 }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgUnique: uniqueIndex('unq_organization_billing_org').on(table.organizationId),
  }),
);
