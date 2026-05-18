'use server';

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { db } from '@/server/db';
import { users, memberships, invitations } from '@/server/db/schema';
import { invitationRepo } from '@/server/repositories/invitation.repo';
import {
  createInvitationSchema,
  acceptInvitationSchema,
  type CreateInvitationInput,
  type AcceptInvitationInput,
} from '@/lib/validators/invitations';
import { issuePendingToken } from '@/lib/auth/pending-token';
import { generateTotpSecret } from '@/lib/auth/totp';
import { getAppBaseUrl } from '@/lib/utils/app-url';
import { assertOrgCapacity } from '@/lib/auth/limits';
import type { ActionResult } from '@/types/actions';

const INVITE_EXPIRY_DAYS = 7;
const INVITABLE_AS_ADMIN = ['owner', 'admin'];

function newToken(): string {
  return randomBytes(32).toString('hex');
}

export async function listPendingInvitations() {
  const session = await auth();
  if (!session?.user) return [];
  return invitationRepo.findPendingByOrg(session.user.organizationId);
}

export async function createInvitationAction(
  input: CreateInvitationInput,
): Promise<ActionResult<{ id: string; token: string; acceptUrl: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };

    requireRole(session.user.role, INVITABLE_AS_ADMIN);

    const validated = createInvitationSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Revisa los campos',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const email = validated.data.email.toLowerCase().trim();
    const orgId = session.user.organizationId;

    const capacity = await assertOrgCapacity(orgId, 'user');
    if (!capacity.ok) return { success: false, error: capacity.message };

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    if (existingUser) {
      const existingMembership = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.userId, existingUser.id),
          eq(memberships.organizationId, orgId),
        ),
        columns: { id: true },
      });
      if (existingMembership) {
        return {
          success: false,
          error: 'Este email ya pertenece a la organización.',
          fieldErrors: { email: ['Ya es miembro'] },
        };
      }
    }

    const token = newToken();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const created = await invitationRepo.create({
      organizationId: orgId,
      email,
      role: validated.data.role,
      invitedByUserId: session.user.id,
      token,
      expiresAt,
    });

    revalidatePath('/settings/team');

    const acceptUrl = `${await getAppBaseUrl()}/accept-invite?token=${token}`;

    return { success: true, data: { id: created!.id, token, acceptUrl } };
  } catch (error) {
    console.error('createInvitationAction failed:', error);
    return { success: false, error: 'No se pudo crear la invitación' };
  }
}

export async function revokeInvitationAction(id: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };
    requireRole(session.user.role, INVITABLE_AS_ADMIN);

    const ok = await invitationRepo.revoke(id, session.user.organizationId);
    if (!ok) return { success: false, error: 'La invitación no existe o ya no es válida' };

    revalidatePath('/settings/team');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('revokeInvitationAction failed:', error);
    return { success: false, error: 'No se pudo revocar la invitación' };
  }
}

export type InvitationStatus =
  | { kind: 'invalid'; reason: 'not_found' | 'expired' | 'revoked' | 'already_accepted' }
  | {
      kind: 'needs_login';
      email: string;
      organizationName: string;
      role: string;
    }
  | {
      kind: 'wrong_account';
      expected: string;
      current: string;
      organizationName: string;
    }
  | {
      kind: 'ready_to_accept';
      email: string;
      organizationName: string;
      role: string;
    }
  | {
      kind: 'needs_signup';
      email: string;
      organizationName: string;
      role: string;
    };

export async function getInvitationStatus(token: string): Promise<InvitationStatus> {
  const inv = await invitationRepo.findByToken(token);
  if (!inv) return { kind: 'invalid', reason: 'not_found' };
  if (inv.acceptedAt) return { kind: 'invalid', reason: 'already_accepted' };
  if (inv.revokedAt) return { kind: 'invalid', reason: 'revoked' };
  if (inv.expiresAt < new Date()) return { kind: 'invalid', reason: 'expired' };

  const session = await auth();
  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, inv.email),
    columns: { id: true },
  });

  if (targetUser) {
    if (!session?.user) {
      return {
        kind: 'needs_login',
        email: inv.email,
        organizationName: inv.organizationName,
        role: inv.role,
      };
    }
    if (session.user.email?.toLowerCase() !== inv.email.toLowerCase()) {
      return {
        kind: 'wrong_account',
        expected: inv.email,
        current: session.user.email ?? '',
        organizationName: inv.organizationName,
      };
    }
    return {
      kind: 'ready_to_accept',
      email: inv.email,
      organizationName: inv.organizationName,
      role: inv.role,
    };
  }

  return {
    kind: 'needs_signup',
    email: inv.email,
    organizationName: inv.organizationName,
    role: inv.role,
  };
}

export type AcceptInvitationResult =
  | { kind: 'joined' }
  | { kind: 'needs_2fa_setup'; pendingToken: string };

export async function acceptInvitationAction(
  input: AcceptInvitationInput,
): Promise<ActionResult<AcceptInvitationResult>> {
  const validated = acceptInvitationSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { token, name, password } = validated.data;

  const inv = await invitationRepo.findByToken(token);
  if (!inv) return { success: false, error: 'Invitación no encontrada' };
  if (inv.acceptedAt) return { success: false, error: 'Esta invitación ya fue aceptada' };
  if (inv.revokedAt) return { success: false, error: 'Esta invitación fue revocada' };
  if (inv.expiresAt < new Date()) return { success: false, error: 'Esta invitación ha caducado' };

  const session = await auth();
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, inv.email),
  });

  if (existingUser) {
    if (!session?.user) {
      return {
        success: false,
        error: `Inicia sesión como ${inv.email} para aceptar la invitación.`,
      };
    }
    if (session.user.email?.toLowerCase() !== inv.email.toLowerCase()) {
      return {
        success: false,
        error: `Esta invitación es para ${inv.email}. Estás conectado como ${session.user.email}.`,
      };
    }

    try {
      await db.transaction(async (tx) => {
        await tx.insert(memberships).values({
          userId: existingUser.id,
          organizationId: inv.organizationId,
          role: inv.role,
          invitedByUserId: inv.invitedByUserId,
          invitedAt: inv.createdAt,
          acceptedAt: new Date(),
          isActive: true,
        });
        await tx
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.id, inv.id));
        await tx
          .update(users)
          .set({ lastActiveOrganizationId: inv.organizationId })
          .where(eq(users.id, existingUser.id));
      });
    } catch (error) {
      console.error('acceptInvitationAction (existing user) failed:', error);
      return { success: false, error: 'No se pudo aceptar la invitación' };
    }

    return { success: true, data: { kind: 'joined' } };
  }

  if (!name || !password) {
    return {
      success: false,
      error: 'Necesitamos tu nombre y contraseña para crear la cuenta',
      fieldErrors: {
        ...(name ? {} : { name: ['Requerido'] }),
        ...(password ? {} : { password: ['Requerido'] }),
      },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let newUserId: string;
  try {
    newUserId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: inv.email,
          name,
          passwordHash,
          lastActiveOrganizationId: inv.organizationId,
        })
        .returning({ id: users.id });

      await tx.insert(memberships).values({
        userId: user!.id,
        organizationId: inv.organizationId,
        role: inv.role,
        invitedByUserId: inv.invitedByUserId,
        invitedAt: inv.createdAt,
        acceptedAt: new Date(),
        isActive: true,
      });

      await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, inv.id));

      return user!.id;
    });
  } catch (error) {
    console.error('acceptInvitationAction (new user) failed:', error);
    return { success: false, error: 'No se pudo crear la cuenta' };
  }

  const secret = generateTotpSecret();
  const pendingToken = issuePendingToken(newUserId, 'setup', {
    setupSecret: secret.base32,
  });

  return { success: true, data: { kind: 'needs_2fa_setup', pendingToken } };
}
