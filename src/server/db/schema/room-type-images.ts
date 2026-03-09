import { pgTable, uuid, varchar, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from './organizations';
import { roomTypes } from './room-types';

export const roomTypeImages = pgTable('room_type_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  alt: varchar('alt', { length: 255 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isCover: boolean('is_cover').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roomTypeImagesRelations = relations(roomTypeImages, ({ one }) => ({
  organization: one(organizations, {
    fields: [roomTypeImages.organizationId],
    references: [organizations.id],
  }),
  roomType: one(roomTypes, {
    fields: [roomTypeImages.roomTypeId],
    references: [roomTypes.id],
  }),
}));
