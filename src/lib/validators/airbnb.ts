import { z } from 'zod';

export const initiateHostActivationSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
});

export const checkHostStatusSchema = z.object({
  airbnbHostId: z.string().uuid('Invalid Airbnb host ID'),
});

export const discoverListingsSchema = z.object({
  airbnbHostId: z.string().uuid('Invalid Airbnb host ID'),
});

export const activateListingSchema = z.object({
  airbnbListingDbId: z.string().uuid('Invalid listing ID'),
  roomTypeId: z.string().uuid('Invalid room type ID'),
  propertyId: z.string().uuid('Invalid property ID'),
});

export const triggerAirbnbSyncSchema = z.object({
  integrationId: z.string().uuid('Invalid integration ID'),
});

export const airbnbAvailabilityRulesSchema = z.object({
  airbnbListingDbId: z.string().uuid('Invalid listing ID'),
  defaultMinNights: z.number().int().min(1).max(365).optional(),
  defaultMaxNights: z.number().int().min(1).max(1125).optional(),
  bookingLeadTimeHours: z.number().int().min(0).max(720).optional(),
  maxDaysNoticeDays: z.number().int().min(1).max(730).optional(),
  turnoverDays: z.number().int().min(0).max(30).optional(),
});

export const airbnbPricingSettingsSchema = z.object({
  airbnbListingDbId: z.string().uuid('Invalid listing ID'),
  listingCurrency: z.string().length(3, 'Currency must be 3 characters'),
  defaultDailyPrice: z.number().min(0).max(99999),
  weekendPrice: z.number().min(0).max(99999).optional(),
  guestsIncluded: z.number().int().min(0).max(100).optional(),
  pricePerExtraPerson: z.number().min(0).max(9999).optional(),
});

export type InitiateHostActivationInput = z.infer<typeof initiateHostActivationSchema>;
export type CheckHostStatusInput = z.infer<typeof checkHostStatusSchema>;
export type DiscoverListingsInput = z.infer<typeof discoverListingsSchema>;
export type ActivateListingInput = z.infer<typeof activateListingSchema>;
export type TriggerAirbnbSyncInput = z.infer<typeof triggerAirbnbSyncSchema>;
export type AirbnbAvailabilityRulesInput = z.infer<typeof airbnbAvailabilityRulesSchema>;
export type AirbnbPricingSettingsInput = z.infer<typeof airbnbPricingSettingsSchema>;
