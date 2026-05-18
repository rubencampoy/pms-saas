import { pgTable, uuid, varchar, text, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';
import { roomTypes } from './room-types';
import { ratePlans } from './rate-plans';

// ── Integrations ──

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    propertyId: uuid('property_id').notNull().references(() => properties.id),
    provider: varchar('provider', { length: 30 }).notNull(),
    credentials: text('credentials').notNull(), // AES-256-GCM encrypted JSON
    webhookToken: varchar('webhook_token', { length: 64 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSyncStatus: varchar('last_sync_status', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_integrations_property_provider').on(
      table.propertyId,
      table.provider,
    ),
  ],
);

// ── Room Type Mappings ──

export const roomTypeMappings = pgTable(
  'room_type_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
    externalRoomTypeId: varchar('external_room_type_id', { length: 128 }).notNull(),
    externalRoomTypeName: varchar('external_room_type_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_room_type_mappings_integration_room').on(
      table.integrationId,
      table.roomTypeId,
    ),
  ],
);

// ── Rate Plan Mappings ──

export const ratePlanMappings = pgTable(
  'rate_plan_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    ratePlanId: uuid('rate_plan_id').notNull().references(() => ratePlans.id),
    externalRatePlanId: varchar('external_rate_plan_id', { length: 128 }).notNull(),
    externalRatePlanName: varchar('external_rate_plan_name', { length: 255 }).notNull(),
    externalRoomTypeId: varchar('external_room_type_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('unq_rate_plan_mappings_integration_rate').on(
      table.integrationId,
      table.ratePlanId,
    ),
  ],
);

// ── Channel Manager Logs ──

export const channelManagerLogs = pgTable('channel_manager_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id),
  direction: varchar('direction', { length: 10 }).notNull(), // inbound | outbound
  action: varchar('action', { length: 30 }).notNull(),
  status: varchar('status', { length: 10 }).notNull(), // success | error
  request: text('request'), // JSON stringified
  response: text('response'), // JSON stringified
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
