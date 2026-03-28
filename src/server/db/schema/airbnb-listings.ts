import { pgTable, uuid, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { integrations } from './integrations';
import { airbnbHosts } from './airbnb-hosts';
import { roomTypes } from './room-types';
import { properties } from './properties';

export const airbnbListings = pgTable(
  'airbnb_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    airbnbHostId: uuid('airbnb_host_id')
      .notNull()
      .references(() => airbnbHosts.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    airbnbListingId: varchar('airbnb_listing_id', { length: 128 }).notNull(),
    airbnbRoomId: varchar('airbnb_room_id', { length: 128 }),
    airbnbRateId: varchar('airbnb_rate_id', { length: 128 }),
    listingName: varchar('listing_name', { length: 500 }),
    propertyType: varchar('property_type', { length: 100 }),
    isActivated: boolean('is_activated').notNull().default(false),
    isMultiUnit: boolean('is_multi_unit').notNull().default(false),
    roomTypeId: uuid('room_type_id').references(() => roomTypes.id),
    propertyId: uuid('property_id').references(() => properties.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_airbnb_listings_org_listing').on(
      table.organizationId,
      table.airbnbListingId,
    ),
  ],
);
