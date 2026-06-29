'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import {
  updateIpRestrictionSchema,
  type UpdateIpRestrictionInput,
} from '@/lib/validators/ip-restriction';
import { propertyRepo } from '@/server/repositories/property.repo';
import { getClientIp } from '@/lib/security/ip-guard';
import { isIpAllowed } from '@/lib/security/ip';
import type { ActionResult } from '@/types/actions';

/** Returns the caller's current public IP (for the settings UI). */
export async function getMyPublicIp(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  return getClientIp();
}

export async function updatePropertyIpRestriction(
  input: UpdateIpRestrictionInput,
): Promise<ActionResult<{ id: string; allowedIps: string[] }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    requireRole(session.user.role, ['owner', 'admin']);

    const validated = updateIpRestrictionSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { propertyId, ipRestrictionEnabled } = validated.data;
    let allowedIps = Array.from(
      new Set(validated.data.allowedIps.map((s) => s.trim()).filter(Boolean)),
    );

    // Anti-lockout: when enabling, ensure the admin's current IP is on the list
    // so they can't accidentally fence themselves out.
    if (ipRestrictionEnabled) {
      const clientIp = await getClientIp();
      if (clientIp && !isIpAllowed(clientIp, allowedIps)) {
        allowedIps = [...allowedIps, clientIp];
      }
      if (allowedIps.length === 0) {
        return {
          success: false,
          error: 'Debes añadir al menos una IP cuando la restricción está activa',
        };
      }
    }

    const property = await propertyRepo.updateIpRestriction(
      session.user.organizationId,
      propertyId,
      { ipRestrictionEnabled, allowedIps },
    );

    if (!property) {
      return { success: false, error: 'Property not found' };
    }

    revalidatePath('/settings/security');
    // Refresh the dashboard layout so the IP guard re-evaluates immediately.
    revalidatePath('/', 'layout');
    return { success: true, data: { id: property.id, allowedIps } };
  } catch (error) {
    console.error('updatePropertyIpRestriction failed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
