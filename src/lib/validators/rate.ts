import { z } from 'zod';

// ── Rate Plan ──
export const createRatePlanSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().min(1, 'Code is required').max(10),
  description: z.string().max(1000).optional(),
  cancellationPolicy: z.enum(['free', 'moderate', 'strict', 'non_refundable']).default('free'),
  cancellationHours: z.number().int().min(0).max(720).default(24),
  priority: z.number().int().min(0).max(100).default(0),
});

export const updateRatePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(10).optional(),
  description: z.string().max(1000).optional(),
  cancellationPolicy: z.enum(['free', 'moderate', 'strict', 'non_refundable']).optional(),
  cancellationHours: z.number().int().min(0).max(720).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

// ── Rate (bulk set) ──
export const BULK_RATE_FIELDS = ['amount', 'minStay', 'maxStay', 'closedToArrival', 'closedToDeparture'] as const;
export type BulkRateField = (typeof BULK_RATE_FIELDS)[number];

export const bulkSetRatesSchema = z.object({
  ratePlanId: z.string().uuid('Invalid rate plan ID'),
  roomTypeIds: z.array(z.string().uuid('Invalid room type ID')).min(1, 'Select at least one room type'),
  startDate: z.string().date('Invalid start date'),
  endDate: z.string().date('Invalid end date'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one day').default([0, 1, 2, 3, 4, 5, 6]),
  fields: z.array(z.enum(BULK_RATE_FIELDS)).min(1, 'Select at least one field to update'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount').optional(),
  currency: z.string().length(3).default('EUR'),
  minStay: z.number().int().min(1).max(30).optional(),
  maxStay: z.number().int().min(1).max(365).nullable().optional(),
  closedToArrival: z.boolean().optional(),
  closedToDeparture: z.boolean().optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be on or after start date', path: ['endDate'] },
).refine(
  (data) => !data.fields.includes('amount') || (data.amount !== undefined && data.amount !== ''),
  { message: 'Amount is required when selected', path: ['amount'] },
).refine(
  (data) => !data.fields.includes('minStay') || data.minStay !== undefined,
  { message: 'Min stay is required when selected', path: ['minStay'] },
);

// ── Season ──
export const createSeasonSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  name: z.string().min(1, 'Name is required').max(255),
  startDate: z.string().date('Invalid start date'),
  endDate: z.string().date('Invalid end date'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#3B82F6'),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] },
);

export const updateSeasonSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// ── Supplement ──
export const createSupplementSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['per_night', 'per_stay', 'per_person_per_night', 'one_time'], {
    message: 'Invalid supplement type',
  }),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid tax rate').default('0'),
});

export const updateSupplementSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['per_night', 'per_stay', 'per_person_per_night', 'one_time']).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  taxRate: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  isActive: z.boolean().optional(),
});

// ── Rate Cell (batch update) ──
export const rateCellChangeSchema = z.object({
  ratePlanId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  date: z.string().date(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount').optional(),
  minStay: z.number().int().min(1).max(30).optional(),
  maxStay: z.number().int().min(1).max(365).nullable().optional(),
  closedToArrival: z.boolean().optional(),
  closedToDeparture: z.boolean().optional(),
}).refine(
  (data) =>
    data.amount !== undefined ||
    data.minStay !== undefined ||
    data.maxStay !== undefined ||
    data.closedToArrival !== undefined ||
    data.closedToDeparture !== undefined,
  { message: 'At least one field must be provided' },
);

export const batchUpdateRatesSchema = z.object({
  changes: z.array(rateCellChangeSchema).min(1).max(500),
});

export type CreateRatePlanInput = z.infer<typeof createRatePlanSchema>;
export type UpdateRatePlanInput = z.infer<typeof updateRatePlanSchema>;
export type BulkSetRatesInput = z.infer<typeof bulkSetRatesSchema>;
export type RateCellChange = z.infer<typeof rateCellChangeSchema>;
export type BatchUpdateRatesInput = z.infer<typeof batchUpdateRatesSchema>;
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
