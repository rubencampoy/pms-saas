'use server';

import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAppBaseUrl } from '@/lib/utils/app-url';
import { db } from '@/server/db';
import {
  organizations,
  invitations,
  users,
  properties,
  superAdminAccessLog,
} from '@/server/db/schema';
import { slugify } from '@/lib/utils/slug';
import { UserRole } from '@/lib/constants/roles';
import {
  createOrganizationAsAdminSchema,
  updateOrganizationLimitsSchema,
  suspendOrganizationSchema,
  createPropertyAsAdminSchema,
  updatePropertyLimitsSchema,
  type CreateOrganizationAsAdminInput,
  type UpdateOrganizationLimitsInput,
  type SuspendOrganizationInput,
  type CreatePropertyAsAdminInput,
  type UpdatePropertyLimitsInput,
} from '@/lib/validators/admin';
import { assertOrgCapacity } from '@/lib/auth/limits';
import type { ActionResult } from '@/types/actions';

const INVITE_EXPIRY_DAYS = 14;

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

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: 'No autenticado' };
  if (!session.user.isSuperAdmin) {
    return { ok: false as const, error: 'Solo super admins' };
  }
  return { ok: true as const, session };
}

// ─── Organization actions ────────────────────────────────────────────────

export async function createOrganizationAsAdminAction(
  input: CreateOrganizationAsAdminInput,
): Promise<ActionResult<{ organizationId: string; acceptUrl: string; token: string }>> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const { session } = guard;

  const validated = createOrganizationAsAdminSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Revisa los campos del formulario',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { organizationName, ownerName: _ownerName, ownerEmail, maxProperties, maxUsers } = validated.data;
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
        .values({ name: organizationName, slug, maxProperties, maxUsers })
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

export async function updateOrganizationLimitsAction(
  input: UpdateOrganizationLimitsInput,
): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const { session } = guard;

  const validated = updateOrganizationLimitsSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Revisa los campos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { organizationId, maxProperties, maxUsers } = validated.data;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({ maxProperties, maxUsers, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId));

      await tx.insert(superAdminAccessLog).values({
        superAdminUserId: session.user.id,
        organizationId,
        action: 'update_org_limits',
        reason: `maxProperties=${maxProperties} maxUsers=${maxUsers}`,
      });
    });
  } catch (error) {
    console.error('updateOrganizationLimitsAction failed:', error);
    return { success: false, error: 'No se pudo actualizar' };
  }

  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${organizationId}`);
  return { success: true, data: undefined };
}

export async function suspendOrganizationAction(
  input: SuspendOrganizationInput,
): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const { session } = guard;

  const validated = suspendOrganizationSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Indica un motivo',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { organizationId, reason } = validated.data;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({
          status: 'suspended',
          suspendedAt: new Date(),
          suspendedReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));

      await tx.insert(superAdminAccessLog).values({
        superAdminUserId: session.user.id,
        organizationId,
        action: 'suspend_organization',
        reason,
      });
    });
  } catch (error) {
    console.error('suspendOrganizationAction failed:', error);
    return { success: false, error: 'No se pudo suspender' };
  }

  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${organizationId}`);
  return { success: true, data: undefined };
}

export async function reactivateOrganizationAction(
  organizationId: string,
): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const { session } = guard;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({
          status: 'active',
          suspendedAt: null,
          suspendedReason: null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));

      await tx.insert(superAdminAccessLog).values({
        superAdminUserId: session.user.id,
        organizationId,
        action: 'reactivate_organization',
      });
    });
  } catch (error) {
    console.error('reactivateOrganizationAction failed:', error);
    return { success: false, error: 'No se pudo reactivar' };
  }

  revalidatePath('/admin/organizations');
  revalidatePath(`/admin/organizations/${organizationId}`);
  return { success: true, data: undefined };
}

// ─── Property actions (super admin manages plan + limits) ────────────────

export async function createPropertyAsAdminAction(
  input: CreatePropertyAsAdminInput,
): Promise<ActionResult<{ propertyId: string }>> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const { session } = guard;

  const validated = createPropertyAsAdminSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Revisa los campos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { organizationId, name, code, plan, maxUnits } = validated.data;
  const upperCode = code.toUpperCase();

  // Check uniqueness of code within the org
  const dup = await db.query.properties.findFirst({
    where: and(eq(properties.organizationId, organizationId), eq(properties.code, upperCode)),
    columns: { id: true },
  });
  if (dup) {
    return {
      success: false,
      error: `Ya existe una propiedad con código ${upperCode} en esta organización`,
      fieldErrors: { code: ['Código duplicado'] },
    };
  }

  // Enforce max_properties at the org level
  const capacity = await assertOrgCapacity(organizationId, 'property');
  if (!capacity.ok) return { success: false, error: capacity.message };

  let propertyId: string;
  try {
    propertyId = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(properties)
        .values({ organizationId, name, code: upperCode, plan, maxUnits })
        .returning({ id: properties.id });

      await tx.insert(superAdminAccessLog).values({
        superAdminUserId: session.user.id,
        organizationId,
        action: 'create_property',
        reason: `name=${name} code=${upperCode} plan=${plan} maxUnits=${maxUnits}`,
      });

      return p!.id;
    });
  } catch (error) {
    console.error('createPropertyAsAdminAction failed:', error);
    return { success: false, error: 'No se pudo crear la propiedad' };
  }

  revalidatePath(`/admin/organizations/${organizationId}`);
  return { success: true, data: { propertyId } };
}

export async function updatePropertyLimitsAction(
  input: UpdatePropertyLimitsInput,
): Promise<ActionResult> {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const { session } = guard;

  const validated = updatePropertyLimitsSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: 'Revisa los campos',
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { propertyId, plan, maxUnits } = validated.data;

  const property = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
    columns: { id: true, organizationId: true },
  });
  if (!property) return { success: false, error: 'Propiedad no encontrada' };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(properties)
        .set({ plan, maxUnits, updatedAt: new Date() })
        .where(eq(properties.id, propertyId));

      await tx.insert(superAdminAccessLog).values({
        superAdminUserId: session.user.id,
        organizationId: property.organizationId,
        action: 'update_property_limits',
        reason: `propertyId=${propertyId} plan=${plan} maxUnits=${maxUnits}`,
      });
    });
  } catch (error) {
    console.error('updatePropertyLimitsAction failed:', error);
    return { success: false, error: 'No se pudo actualizar' };
  }

  revalidatePath(`/admin/organizations/${property.organizationId}`);
  return { success: true, data: undefined };
}
