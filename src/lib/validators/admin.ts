import { z } from 'zod';

export const createOrganizationAsAdminSchema = z.object({
  organizationName: z
    .string()
    .min(2, 'El nombre de la organización debe tener al menos 2 caracteres')
    .max(255),
  ownerName: z.string().min(2, 'El nombre del owner debe tener al menos 2 caracteres').max(255),
  ownerEmail: z.string().email('Email inválido').max(255),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']).default('free'),
});

export type CreateOrganizationAsAdminInput = z.infer<typeof createOrganizationAsAdminSchema>;
