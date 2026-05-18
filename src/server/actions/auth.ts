'use server';

import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { signIn, signOut } from '@/lib/auth';
import { db } from '@/server/db';
import {
  users,
  userRecoveryCodes,
  organizations,
  memberships,
} from '@/server/db/schema';
import {
  loginSchema,
  registerSchema,
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
import { slugify } from '@/lib/utils/slug';
import { UserRole } from '@/lib/constants/roles';
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

async function findFreeSlug(base: string): Promise<string> {
  const root = slugify(base) || 'org';
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, candidate),
      columns: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/**
 * Self-signup: create a new Organization + Owner user + membership in one tx.
 * Returns a 'setup' pending token so the client can redirect to /setup-2fa
 * (2FA is mandatory — no auto-signIn).
 */
export async function registerOrganizationAction(input: {
  ownerName: string;
  email: string;
  password: string;
  organizationName: string;
}): Promise<ActionResult<{ pendingToken: string }>> {
  const validated = registerSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Revisa los campos del formulario',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { ownerName, email, password, organizationName } = validated.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
    columns: { id: true },
  });
  if (existingUser) {
    return {
      success: false,
      error: 'Ya existe una cuenta con este email. Inicia sesión o usa otro email.',
      fieldErrors: { email: ['Email ya registrado'] },
    };
  }

  const slug = await findFreeSlug(organizationName);
  const passwordHash = await bcrypt.hash(password, 10);

  let newUserId: string;
  try {
    newUserId = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: organizationName,
          slug,
          plan: 'free',
        })
        .returning({ id: organizations.id });

      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          name: ownerName,
          passwordHash,
          lastActiveOrganizationId: org!.id,
        })
        .returning({ id: users.id });

      await tx.insert(memberships).values({
        userId: user!.id,
        organizationId: org!.id,
        role: UserRole.OWNER,
        acceptedAt: new Date(),
        isActive: true,
      });

      return user!.id;
    });
  } catch (error) {
    console.error('registerOrganizationAction transaction failed:', error);
    return {
      success: false,
      error: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
    };
  }

  const secret = generateTotpSecret();
  const pendingToken = issuePendingToken(newUserId, 'setup', {
    setupSecret: secret.base32,
  });

  return { success: true, data: { pendingToken } };
}
