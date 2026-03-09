import { z } from 'zod';

export const bookingEngineSettingsSchema = z.object({
  propertyId: z.string().uuid(),

  // Settings tab
  availabilityView: z.enum(['collapsed', 'expanded']).default('collapsed'),
  priceFormat: z.enum(['lowest_night', 'total_stay']).default('lowest_night'),
  specificRoom: z.boolean().default(false),
  addonsDisplay: z.enum(['before', 'after']).default('before'),
  guestFilter: z.enum(['full', 'adults_children', 'none']).default('full'),
  defaultAdults: z.number().int().min(1).max(10).default(2),

  // Accommodation
  showUnavailable: z.boolean().default(true),
  autoAssign: z.boolean().default(true),
  limitByType: z.boolean().default(false),
  showRestrictions: z.boolean().default(true),
  showRates: z.boolean().default(false),

  // Guest info
  fieldPostalAddress: z.boolean().default(true),
  fieldNationality: z.boolean().default(true),
  fieldGender: z.boolean().default(false),
  fieldIdDocument: z.boolean().default(true),
  fieldCompany: z.boolean().default(false),
  fieldPhone: z.boolean().default(true),
  fieldArrivalTime: z.boolean().default(false),
  fieldTermsAndConditions: z.boolean().default(true),

  // Marketing
  autoConfirmEmail: z.boolean().default(true),
  redirectConfirmation: z.boolean().default(false),
  redirectUrl: z.string().max(500).default(''),

  // Payment
  requireCvv: z.boolean().default(true),

  // Language
  language: z.string().max(10).default('es'),

  // Analytics tab
  analyticsPlatform: z.enum(['ga4', 'gtm']).default('ga4'),
  gaTrackingId: z.string().max(50).default(''),
  gaDomain: z.string().max(255).default(''),
  googleAdsConversionId: z.string().max(50).default(''),
  googleAdsConversionLabel: z.string().max(50).default(''),
  facebookPixelId: z.string().max(50).default(''),

  // Widgets tab
  widgetType: z.enum(['stacked', 'horizontal', 'floating', 'bigButton', 'smallButton', 'overlay', 'immersive']).default('stacked'),
  widgetLanguage: z.string().max(10).default('es'),
  widgetOpenNewWindow: z.boolean().default(false),
});

export type BookingEngineSettingsInput = z.infer<typeof bookingEngineSettingsSchema>;
