'use server';

import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { signIn, signOut } from '@/lib/auth';
import { db } from '@/server/db';
import { users, userRecoveryCodes } from '@/server/db/schema';
import {
  loginSchema,
  setupTotpSchema,
  verifyTotpSchema,
} from '@/lib/validators/auth';
import {
  issuePendingToken,
  verifyPendingToken,
} from '@/lib/auth/pending-token';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from '@/lib/auth/totp';
import { Secret } from 'otpauth';
import { isTrustedDevice, issueTrustedDevice } from '@/lib/auth/trusted-device';
import type { ActionResult } from '@/types/actions';

const GENERIC_AUTH_ERROR = 'Email o contraseña incorrectos';
const STEP_EXPIRED = 'La sesión de inicio ha expirado. Vuelve a introducir tus credenciales.';
const INVALID_CODE = 'Código incorrecto. Inténtalo de nuevo.';

export type LoginNext =
  | { next: 'done' }
  | { next: 'totp'; pendingToken: string }
  | { next: 'setup'; pendingToken: string };

/**
 * Step 1: validate email + password. Decide what step 2 looks like:
 *  - Trusted device cookie present → mint session immediately.
 *  - TOTP already enrolled         → return a `verify` pending token.
 *  - No TOTP yet                   → return a `setup` pending token carrying
 *                                    the freshly-generated secret.
 */
export async function loginStep1Action(
  input: { email: string; password: string },
): Promise<ActionResult<LoginNext>> {
  const validated = loginSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Datos de acceso inválidos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, password } = validated.data;

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), eq(users.isActive, true)),
  });

  if (!user || !user.passwordHash) {
    await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) return { success: false, error: GENERIC_AUTH_ERROR };

  if (user.totpEnabled && (await isTrustedDevice(user.id))) {
    try {
      await signIn('credentials', {
        pendingToken: issuePendingToken(user.id, 'trusted'),
        redirect: false,
      });
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      return { success: true, data: { next: 'done' } };
    } catch (error) {
      if (error instanceof AuthError) return { success: false, error: GENERIC_AUTH_ERROR };
      throw error;
    }
  }

  if (user.totpEnabled) {
    return {
      success: true,
      data: { next: 'totp', pendingToken: issuePendingToken(user.id, 'verify') },
    };
  }

  const secret = generateTotpSecret();
  return {
    success: true,
    data: {
      next: 'setup',
      pendingToken: issuePendingToken(user.id, 'setup', { setupSecret: secret.base32 }),
    },
  };
}

/**
 * Complete first-time 2FA enrollment:
 *  - Verify the 6-digit code against the secret carried in the pending token
 *  - Persist the encrypted secret + 10 bcrypt-hashed recovery codes (atomic)
 *  - Optionally issue a 30-day trusted-device cookie
 *  - Mint the session and return the plaintext recovery codes (once).
 */
export async function setupTotpAction(input: {
  pendingToken: string;
  code: string;
  trustDevice?: boolean;
}): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const validated = setupTotpSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const payload = verifyPendingToken(validated.data.pendingToken);
  if (!payload || payload.purpose !== 'setup' || !payload.setupSecret) {
    return { success: false, error: STEP_EXPIRED };
  }

  const secret = Secret.fromBase32(payload.setupSecret);
  if (!verifyTotpCode(secret, validated.data.code)) {
    return { success: false, error: INVALID_CODE };
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, payload.userId), eq(users.isActive, true)),
  });
  if (!user) return { success: false, error: STEP_EXPIRED };

  const plaintextCodes = generateRecoveryCodes();
  const hashedCodes = await Promise.all(plaintextCodes.map(hashRecoveryCode));

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        totpSecret: encryptTotpSecret(secret),
        totpEnabled: true,
        totpEnrolledAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, user.id));
    await tx.insert(userRecoveryCodes).values(
      hashedCodes.map((codeHash) => ({
        userId: user.id,
        codeHash,
      })),
    );
  });

  if (validated.data.trustDevice) {
    await issueTrustedDevice(user.id);
  }

  try {
    await signIn('credentials', {
      pendingToken: issuePendingToken(user.id, 'trusted'),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: GENERIC_AUTH_ERROR };
    throw error;
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  return { success: true, data: { recoveryCodes: plaintextCodes } };
}

/**
 * Step 2 for users who already have TOTP enrolled: verify either a 6-digit
 * code or a single-use recovery code, then mint the session.
 */
export async function verifyTotpAction(input: {
  pendingToken: string;
  code?: string;
  recoveryCode?: string;
  trustDevice?: boolean;
}): Promise<ActionResult> {
  const validated = verifyTotpSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const payload = verifyPendingToken(validated.data.pendingToken);
  if (!payload || payload.purpose !== 'verify') {
    return { success: false, error: STEP_EXPIRED };
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, payload.userId), eq(users.isActive, true)),
  });
  if (!user || !user.totpSecret || !user.totpEnabled) {
    return { success: false, error: STEP_EXPIRED };
  }

  let verified = false;

  if (validated.data.code) {
    verified = verifyTotpCode(decryptTotpSecret(user.totpSecret), validated.data.code);
  } else if (validated.data.recoveryCode) {
    const activeCodes = await db
      .select({ id: userRecoveryCodes.id, codeHash: userRecoveryCodes.codeHash })
      .from(userRecoveryCodes)
      .where(and(eq(userRecoveryCodes.userId, user.id), isNull(userRecoveryCodes.usedAt)));

    for (const row of activeCodes) {
      if (await verifyRecoveryCode(validated.data.recoveryCode, row.codeHash)) {
        await db
          .update(userRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(eq(userRecoveryCodes.id, row.id));
        verified = true;
        break;
      }
    }
  }

  if (!verified) return { success: false, error: INVALID_CODE };

  if (validated.data.trustDevice) {
    await issueTrustedDevice(user.id);
  }

  try {
    await signIn('credentials', {
      pendingToken: issuePendingToken(user.id, 'trusted'),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: GENERIC_AUTH_ERROR };
    throw error;
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  return { success: true, data: undefined };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
}
