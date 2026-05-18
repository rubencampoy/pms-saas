import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Introduce un email válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'El código debe tener 6 dígitos');

export const recoveryCodeSchema = z
  .string()
  .trim()
  .min(8, 'Código de recuperación inválido')
  .max(32, 'Código de recuperación inválido');

export const setupTotpSchema = z.object({
  pendingToken: z.string().min(1),
  code: totpCodeSchema,
  trustDevice: z.boolean().optional().default(false),
});
export type SetupTotpInput = z.infer<typeof setupTotpSchema>;

export const verifyTotpSchema = z
  .object({
    pendingToken: z.string().min(1),
    code: totpCodeSchema.optional(),
    recoveryCode: recoveryCodeSchema.optional(),
    trustDevice: z.boolean().optional().default(false),
  })
  .refine((v) => Boolean(v.code) !== Boolean(v.recoveryCode), {
    message: 'Introduce un código de 6 dígitos o un código de recuperación',
    path: ['code'],
  });
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(255).optional(),
  password: z.string().min(8).max(128).optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
