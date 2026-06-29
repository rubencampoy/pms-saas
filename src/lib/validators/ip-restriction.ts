import { z } from 'zod';
import { isValidIpOrCidr } from '@/lib/security/ip';

export const updateIpRestrictionSchema = z
  .object({
    propertyId: z.string().uuid(),
    ipRestrictionEnabled: z.boolean(),
    allowedIps: z
      .array(
        z
          .string()
          .trim()
          .refine(isValidIpOrCidr, 'Dirección IP o CIDR no válido'),
      )
      .max(100),
  })
  .refine((d) => !d.ipRestrictionEnabled || d.allowedIps.length > 0, {
    message: 'Debes añadir al menos una IP cuando la restricción está activa',
    path: ['allowedIps'],
  });

export type UpdateIpRestrictionInput = z.infer<typeof updateIpRestrictionSchema>;
