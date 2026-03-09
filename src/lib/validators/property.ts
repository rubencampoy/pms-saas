import { z } from 'zod';

export const createPropertySchema = z.object({
  name: z.string().min(1, 'Property name is required').max(255),
  code: z.string().min(1, 'Property code is required').max(10),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
  timezone: z.string().max(50).optional(),
});

export const updatePropertySchema = createPropertySchema
  .partial()
  .extend({ id: z.string().uuid() });

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
