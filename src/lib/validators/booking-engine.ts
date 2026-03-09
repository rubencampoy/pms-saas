import { z } from 'zod';

export const searchAvailabilitySchema = z
  .object({
    slug: z.string().min(1).max(100),
    propertyCode: z.string().min(1).max(10),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    adults: z.coerce.number().int().min(1).max(20).default(2),
    children: z.coerce.number().int().min(0).max(20).default(0),
    promoCode: z.string().max(50).optional(),
  })
  .refine(
    (data) => new Date(data.checkOutDate) > new Date(data.checkInDate),
    { message: 'Check-out date must be after check-in date', path: ['checkOutDate'] },
  )
  .refine(
    (data) => new Date(data.checkInDate) >= new Date(new Date().toISOString().split('T')[0]!),
    { message: 'Check-in date cannot be in the past', path: ['checkInDate'] },
  );

export const bookingSelectionSchema = z.object({
  items: z
    .array(
      z.object({
        roomTypeId: z.string().uuid(),
        ratePlanId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1, 'Select at least one room'),
  addonIds: z.array(z.string().uuid()).default([]),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).default(0),
});

export type SearchAvailabilityInput = z.infer<typeof searchAvailabilitySchema>;
export type BookingSelectionInput = z.infer<typeof bookingSelectionSchema>;
