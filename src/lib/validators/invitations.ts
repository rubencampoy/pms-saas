import { z } from 'zod';

export const INVITABLE_ROLES = ['admin', 'manager', 'front_desk', 'housekeeping'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const createInvitationSchema = z.object({
  email: z.string().email('Introduce un email válido').max(255),
  role: z.enum(INVITABLE_ROLES, { message: 'Rol inválido' }),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1).max(64),
    name: z.string().min(2).max(255).optional(),
    password: z.string().min(8).max(128).optional(),
    passwordConfirm: z.string().max(128).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password && data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: 'custom',
        path: ['passwordConfirm'],
        message: 'Las contraseñas no coinciden',
      });
    }
  });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
