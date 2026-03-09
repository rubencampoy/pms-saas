import { z } from 'zod';

export const checkoutGuestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional(),
  nationality: z.string().max(3).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  documentType: z.enum(['passport', 'national_id', 'driving_license', 'other']).optional(),
  documentNumber: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  address: z
    .object({
      street: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      postalCode: z.string().max(20).optional(),
      country: z.string().max(100).optional(),
    })
    .optional(),
  arrivalTime: z.string().max(10).optional(),
  specialRequests: z.string().max(1000).optional(),
  acceptTerms: z.boolean().optional(),
});

export const createBookingSchema = z.object({
  guest: checkoutGuestSchema,
  items: z
    .array(
      z.object({
        roomTypeId: z.string().uuid(),
        ratePlanId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1),
  addonIds: z.array(z.string().uuid()),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20),
});

export type CheckoutGuestInput = z.infer<typeof checkoutGuestSchema>;
export type CreateBookingPayload = z.infer<typeof createBookingSchema>;
