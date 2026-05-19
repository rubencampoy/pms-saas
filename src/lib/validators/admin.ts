import { z } from 'zod';

export const ORG_PLANS = ['free', 'starter', 'professional', 'enterprise'] as const;
export type OrgPlan = (typeof ORG_PLANS)[number];

// Roles a super admin can grant when inviting from the platform panel.
// Includes 'owner' so the platform can seat a new owner if needed.
export const ADMIN_INVITABLE_ROLES = [
  'owner',
  'admin',
  'manager',
  'front_desk',
  'housekeeping',
] as const;
export type AdminInvitableRole = (typeof ADMIN_INVITABLE_ROLES)[number];

// ─── Organization (super admin) ──────────────────────────────────────────

export const createOrganizationAsAdminSchema = z.object({
  organizationName: z
    .string()
    .min(2, 'El nombre de la organización debe tener al menos 2 caracteres')
    .max(255),
  ownerName: z.string().min(2, 'El nombre del owner debe tener al menos 2 caracteres').max(255),
  ownerEmail: z.string().email('Email inválido').max(255),
  maxProperties: z.coerce.number().int().min(1).max(10000).default(1),
  maxUsers: z.coerce.number().int().min(1).max(10000).default(3),
});

export type CreateOrganizationAsAdminInput = z.infer<typeof createOrganizationAsAdminSchema>;

export const updateOrganizationLimitsSchema = z.object({
  organizationId: z.string().uuid(),
  maxProperties: z.coerce.number().int().min(1).max(10000),
  maxUsers: z.coerce.number().int().min(1).max(10000),
});

export type UpdateOrganizationLimitsInput = z.infer<typeof updateOrganizationLimitsSchema>;

export const suspendOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().min(1, 'Indica un motivo').max(500),
});

export type SuspendOrganizationInput = z.infer<typeof suspendOrganizationSchema>;

// ─── Property (super admin) ──────────────────────────────────────────────

export const createPropertyAsAdminSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2, 'Nombre obligatorio').max(255),
  code: z
    .string()
    .min(1, 'Código obligatorio')
    .max(10, 'Máximo 10 caracteres')
    .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guion y guion bajo'),
  plan: z.enum(ORG_PLANS).default('free'),
  maxUnits: z.coerce.number().int().min(1).max(100000).default(10),
});

export type CreatePropertyAsAdminInput = z.infer<typeof createPropertyAsAdminSchema>;

export const updatePropertyLimitsSchema = z.object({
  propertyId: z.string().uuid(),
  plan: z.enum(ORG_PLANS),
  maxUnits: z.coerce.number().int().min(1).max(100000),
});

export type UpdatePropertyLimitsInput = z.infer<typeof updatePropertyLimitsSchema>;

// ─── Organization profile (super admin) ──────────────────────────────────

export const updateOrganizationProfileSchema = z.object({
  organizationId: z.string().uuid(),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(255, 'Máximo 255 caracteres'),
});

export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;

// ─── Billing data (super admin) ──────────────────────────────────────────

const optionalString = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === undefined || v === '' ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === undefined || v === '' ? null : v))
  .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Email inválido',
  });

export const updateBillingDataSchema = z.object({
  organizationId: z.string().uuid(),
  legalName: optionalString(255),
  taxId: optionalString(40),
  addressLine1: optionalString(255),
  addressLine2: optionalString(255),
  postalCode: optionalString(20),
  city: optionalString(120),
  state: optionalString(120),
  country: z
    .string()
    .trim()
    .length(2, 'Usa un código de país de 2 letras (ISO 3166-1)')
    .transform((v) => v.toUpperCase())
    .default('ES'),
  billingEmail: optionalEmail,
});

export type UpdateBillingDataInput = z.input<typeof updateBillingDataSchema>;

// ─── Invitation (super admin) ────────────────────────────────────────────

export const inviteUserAsAdminSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email('Email inválido').max(255),
  role: z.enum(ADMIN_INVITABLE_ROLES, { message: 'Rol inválido' }),
});

export type InviteUserAsAdminInput = z.infer<typeof inviteUserAsAdminSchema>;
