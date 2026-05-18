'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { updatePropertySchema } from '@/lib/validators/property';
import { propertyRepo } from '@/server/repositories/property.repo';
import type { ActionResult } from '@/types/actions';
import type { UpdatePropertyInput } from '@/lib/validators/property';

export async function getProperties() {
  const session = await auth();
  if (!session?.user) return [];

  return propertyRepo.findAll(session.user.organizationId);
}

/**
 * Note: creating a property is a super-admin operation (it requires assigning
 * a plan and unit limit). See createPropertyAsAdminAction in admin-organizations.ts.
 * Owners and managers can only edit operational data (name, address, schedule...).
 */
export async function updateProperty(
  input: UpdatePropertyInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['owner', 'admin', 'manager']);

    const validated = updatePropertySchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { id, ...data } = validated.data;
    const property = await propertyRepo.update(
      session.user.organizationId,
      id,
      data,
    );

    if (!property) {
      return { success: false, error: 'Property not found' };
    }

    revalidatePath('/settings');
    return { success: true, data: { id: property.id } };
  } catch (error) {
    console.error('updateProperty failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteProperty(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Only owners can delete a property (irreversible)
    requireRole(session.user.role, ['owner']);

    const property = await propertyRepo.delete(session.user.organizationId, id);

    if (!property) {
      return { success: false, error: 'Property not found' };
    }

    revalidatePath('/settings');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('deleteProperty failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
