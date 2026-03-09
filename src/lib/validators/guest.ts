import { z } from 'zod';

export const createGuestSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  documentType: z.enum(['passport', 'national_id', 'driving_license', 'other']).optional(),
  documentNumber: z.string().max(50).optional().or(z.literal('')),
  nationality: z
    .string()
    .length(2, 'Nationality must be a 2-letter ISO country code')
    .optional()
    .or(z.literal('')),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional()
    .or(z.literal('')),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  vipStatus: z.enum(['none', 'silver', 'gold', 'platinum']).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export const updateGuestSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  documentType: z.enum(['passport', 'national_id', 'driving_license', 'other']).optional(),
  documentNumber: z.string().max(50).optional().or(z.literal('')),
  nationality: z.string().max(2).optional().or(z.literal('')),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional()
    .or(z.literal('')),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  vipStatus: z.enum(['none', 'silver', 'gold', 'platinum']).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export const searchGuestSchema = z.object({
  query: z.string().min(1).max(200),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
