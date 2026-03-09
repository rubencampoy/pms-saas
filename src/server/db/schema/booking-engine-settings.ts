import { pgTable, uuid, varchar, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { properties } from './properties';

export const bookingEngineSettings = pgTable(
  'booking_engine_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    propertyId: uuid('property_id').notNull().references(() => properties.id),

    // ── Settings tab ──
    availabilityView: varchar('availability_view', { length: 20 }).notNull().default('collapsed'),
    priceFormat: varchar('price_format', { length: 20 }).notNull().default('lowest_night'),
    specificRoom: boolean('specific_room').notNull().default(false),
    addonsDisplay: varchar('addons_display', { length: 20 }).notNull().default('before'),
    guestFilter: varchar('guest_filter', { length: 30 }).notNull().default('full'),
    defaultAdults: integer('default_adults').notNull().default(2),

    // Accommodation
    showUnavailable: boolean('show_unavailable').notNull().default(true),
    autoAssign: boolean('auto_assign').notNull().default(true),
    limitByType: boolean('limit_by_type').notNull().default(false),
    showRestrictions: boolean('show_restrictions').notNull().default(true),
    showRates: boolean('show_rates').notNull().default(false),

    // Guest info fields
    fieldPostalAddress: boolean('field_postal_address').notNull().default(true),
    fieldNationality: boolean('field_nationality').notNull().default(true),
    fieldGender: boolean('field_gender').notNull().default(false),
    fieldIdDocument: boolean('field_id_document').notNull().default(true),
    fieldCompany: boolean('field_company').notNull().default(false),
    fieldPhone: boolean('field_phone').notNull().default(true),
    fieldArrivalTime: boolean('field_arrival_time').notNull().default(false),
    fieldTermsAndConditions: boolean('field_terms_and_conditions').notNull().default(true),

    // Marketing
    autoConfirmEmail: boolean('auto_confirm_email').notNull().default(true),
    redirectConfirmation: boolean('redirect_confirmation').notNull().default(false),
    redirectUrl: varchar('redirect_url', { length: 500 }).default(''),

    // Payment
    requireCvv: boolean('require_cvv').notNull().default(true),

    // Language
    language: varchar('language', { length: 10 }).notNull().default('es'),

    // ── Analytics tab ──
    analyticsPlatform: varchar('analytics_platform', { length: 10 }).notNull().default('ga4'),
    gaTrackingId: varchar('ga_tracking_id', { length: 50 }).default(''),
    gaDomain: varchar('ga_domain', { length: 255 }).default(''),
    googleAdsConversionId: varchar('google_ads_conversion_id', { length: 50 }).default(''),
    googleAdsConversionLabel: varchar('google_ads_conversion_label', { length: 50 }).default(''),
    facebookPixelId: varchar('facebook_pixel_id', { length: 50 }).default(''),

    // ── Widgets tab ──
    widgetType: varchar('widget_type', { length: 20 }).notNull().default('stacked'),
    widgetLanguage: varchar('widget_language', { length: 10 }).notNull().default('es'),
    widgetOpenNewWindow: boolean('widget_open_new_window').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('booking_engine_settings_org_property_idx').on(
      table.organizationId,
      table.propertyId,
    ),
  ],
);
