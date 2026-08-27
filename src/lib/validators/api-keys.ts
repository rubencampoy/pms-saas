import { z } from 'zod';
import {
  API_SCOPES,
  RATE_LIMIT_DEFAULT_PER_MINUTE,
  RATE_LIMIT_MAX_PER_MINUTE,
  RATE_LIMIT_MIN_PER_MINUTE,
} from '@/lib/constants/api';

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(100),
  /** Empty string means "all properties in the organization". */
  propertyId: z.string().uuid('Propiedad no válida').optional().or(z.literal('')),
  scopes: z
    .array(z.enum(API_SCOPES))
    .min(1, 'Selecciona al menos un permiso'),
  rateLimitPerMinute: z.coerce
    .number()
    .int()
    .min(RATE_LIMIT_MIN_PER_MINUTE)
    .max(RATE_LIMIT_MAX_PER_MINUTE)
    .default(RATE_LIMIT_DEFAULT_PER_MINUTE),
  /** Business date; the key stops working at the end of this day, UTC. */
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (YYYY-MM-DD)')
    .optional()
    .or(z.literal('')),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
  id: z.string().uuid(),
});
