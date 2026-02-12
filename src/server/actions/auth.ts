'use server';

import { signIn, signOut } from '@/lib/auth';
import { loginSchema } from '@/lib/validators/auth';
import type { ActionResult } from '@/types/actions';
import { AuthError } from 'next-auth';

export async function loginAction(
  input: { email: string; password: string },
): Promise<ActionResult> {
  // Validate input
  const validated = loginSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Datos de acceso inválidos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await signIn('credentials', {
      email: validated.data.email,
      password: validated.data.password,
      redirect: false,
    });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: 'Email o contraseña incorrectos',
      };
    }
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
}
