import { z } from 'zod';

export const ORG_PLANS = ['free', 'starter', 'professional', 'enterprise'] as const;
export type OrgPlan = (typeof ORG_PLANS)[number];

export const createOrganizationAsAdminSchema = z.object({
  organizationName: z
    .string()
    .min(2, 'El nombre de la organización debe tener al menos 2 caracteres')
    .max(255),
  ownerName: z.string().min(2, 'El nombre del owner debe tener al menos 2 caracteres').max(255),
  ownerEmail: z.string().email('Email inválido').max(255),
  plan: z.enum(ORG_PLANS).default('free'),
  maxProperties: z.coerce.number().int().min(1).max(10000).default(1),
  maxUnits: z.coerce.number().int().min(1).max(100000).default(10),
  maxUsers: z.coerce.number().int().min(1).max(10000).default(3),
});

export type CreateOrganizationAsAdminInput = z.infer<typeof createOrganizationAsAdminSchema>;

export const updateOrganizationLimitsSchema = z.object({
  organizationId: z.string().uuid(),
  plan: z.enum(ORG_PLANS),
  maxProperties: z.coerce.number().int().min(1).max(10000),
  maxUnits: z.coerce.number().int().min(1).max(100000),
  maxUsers: z.coerce.number().int().min(1).max(10000),
});

export type UpdateOrganizationLimitsInput = z.infer<typeof updateOrganizationLimitsSchema>;

export const suspendOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().min(1, 'Indica un motivo').max(500),
});

export type SuspendOrganizationInput = z.infer<typeof suspendOrganizationSchema>;
