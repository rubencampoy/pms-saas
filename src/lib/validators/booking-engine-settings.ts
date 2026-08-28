import { z } from 'zod';

/** Color por defecto del motor de reservas (el primario de Chamelio). */
export const DEFAULT_BRAND_COLOR = '#137fec';

/**
 * Fondo de la cabecera del motor: blanca (la de siempre), pintada con el color
 * de marca, o el slate oscuro del sistema de diseño.
 */
export const BOOKING_HEADER_STYLES = ['light', 'brand', 'dark'] as const;
export type BookingHeaderStyle = (typeof BOOKING_HEADER_STYLES)[number];

/** Hex de 6 dígitos con almohadilla. Es lo que consume `<input type="color">`. */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser un hex de 6 dígitos, p. ej. #137fec');

/**
 * URL de un asset de marca: la devuelve nuestro propio endpoint de subida, así
 * que puede ser absoluta (Vercel Blob) o relativa (storage local en desarrollo).
 */
const brandAssetUrlSchema = z
  .string()
  .max(500)
  .refine((v) => v === '' || v.startsWith('/') || v.startsWith('https://'), {
    message: 'URL de asset inválida',
  })
  .default('');

/** Enlace del pie a una página del cliente. Vacío = se oculta el enlace. */
const externalUrlSchema = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//.test(v), {
    message: 'Debe ser una URL que empiece por http:// o https://',
  })
  .default('');

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

  // Branding tab
  brandDisplayName: z.string().max(120).default(''),
  brandPrimaryColor: hexColorSchema.default(DEFAULT_BRAND_COLOR),
  brandLogoUrl: brandAssetUrlSchema,
  brandLogoInverseUrl: brandAssetUrlSchema,
  brandFaviconUrl: brandAssetUrlSchema,
  brandCoverImageUrl: brandAssetUrlSchema,
  brandHideChamelio: z.boolean().default(false),
  brandPrivacyUrl: externalUrlSchema,
  brandTermsUrl: externalUrlSchema,
  brandCookiesUrl: externalUrlSchema,
  brandHeaderStyle: z.enum(BOOKING_HEADER_STYLES).default('light'),

  // Widgets tab
  widgetType: z.enum(['stacked', 'horizontal', 'floating', 'bigButton', 'smallButton', 'overlay', 'immersive']).default('stacked'),
  widgetLanguage: z.string().max(10).default('es'),
  widgetOpenNewWindow: z.boolean().default(false),
});

export type BookingEngineSettingsInput = z.infer<typeof bookingEngineSettingsSchema>;
