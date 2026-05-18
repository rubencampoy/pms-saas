'use server';

import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAppBaseUrl } from '@/lib/utils/app-url';
import { db } from '@/server/db';
import {
  organizations,
  invitations,
  users,
  superAdminAccessLog,
} from '@/server/db/schema';
import { slugify } from '@/lib/utils/slug';
import { UserRole } from '@/lib/constants/roles';
import {
  createOrganizationAsAdminSchema,
  type CreateOrganizationAsAdminInput,
} from '@/lib/validators/admin';
import type { ActionResult } from '@/types/actions';

const INVITE_EXPIRY_DAYS = 14; // a bit longer for sales-led onboarding

function newToken(): string {
  return randomBytes(32).toString('hex');
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
 * Platform super-admin operation: provision a new organization and create
 * an owner-role invitation. The customer receives the accept-invite link
 * (we return it; sending email is a future task).
 *
 * The org is created without any active user — the first owner activates it
 * by accepting the invitation.
 */
export async function createOrganizationAsAdminAction(
  input: CreateOrganizationAsAdminInput,
): Promise<ActionResult<{ organizationId: string; acceptUrl: string; token: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'No autenticado' };
  if (!session.user.isSuperAdmin) {
    return { success: false, error: 'Solo super admins pueden crear organizaciones' };
  }

  const validated = createOrganizationAsAdminSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Revisa los campos del formulario',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { organizationName, ownerName: _ownerName, ownerEmail, plan } = validated.data;
  const normalizedEmail = ownerEmail.toLowerCase().trim();

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
    columns: { id: true },
  });

  const slug = await findFreeSlug(organizationName);
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  let organizationId: string;
  try {
    organizationId = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name: organizationName, slug, plan })
        .returning({ id: organizations.id });

      await tx.insert(invitations).values({
        organizationId: org!.id,
        email: normalizedEmail,
        role: UserRole.OWNER,
        invitedByUserId: session.user.id,
        token,
        expiresAt,
      });

      await tx.insert(superAdminAccessLog).values({
        superAdminUserId: session.user.id,
        organizationId: org!.id,
        action: 'create_organization',
        reason: existingUser
          ? `Created org for existing user ${normalizedEmail}`
          : `Created org with new owner invitation for ${normalizedEmail}`,
      });

      return org!.id;
    });
  } catch (error) {
    console.error('createOrganizationAsAdminAction failed:', error);
    return { success: false, error: 'No se pudo crear la organización' };
  }

  revalidatePath('/admin/organizations');

  const acceptUrl = `${await getAppBaseUrl()}/accept-invite?token=${token}`;

  return { success: true, data: { organizationId, acceptUrl, token } };
}
