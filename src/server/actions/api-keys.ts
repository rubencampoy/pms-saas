'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { generateApiKey } from '@/lib/utils/api-key';
import { apiKeyRepo } from '@/server/repositories/api-key.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import {
  createApiKeySchema,
  revokeApiKeySchema,
  type CreateApiKeyInput,
} from '@/lib/validators/api-keys';
import type { ActionResult } from '@/types/actions';

/**
 * Issuing a credential that can read every guest in the organization is an
 * owner/admin decision, not something a manager or the front desk can do.
 */
const CAN_MANAGE_KEYS = ['owner', 'admin'];

export async function createApiKeyAction(
  input: CreateApiKeyInput,
): Promise<ActionResult<{ id: string; key: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };

    requireRole(session.user.role, CAN_MANAGE_KEYS);

    const validated = createApiKeySchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: 'Revisa los campos',
        fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { name, propertyId, scopes, rateLimitPerMinute, expiresAt } = validated.data;
    const orgId = session.user.organizationId;

    // A property id from the form is still user input: confirm it belongs to
    // this organization before storing it as a scope restriction.
    if (propertyId) {
      const property = await propertyRepo.findById(orgId, propertyId);
      if (!property) {
        return { success: false, error: 'Esa propiedad no existe' };
      }
    }

    const { key, keyPrefix, keyHash } = generateApiKey();

    const created = await apiKeyRepo.create({
      organizationId: orgId,
      propertyId: propertyId || null,
      name,
      keyPrefix,
      keyHash,
      scopes,
      rateLimitPerMinute,
      // End of the chosen day, so a key dated today still works all day.
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999Z`) : null,
      createdBy: session.user.id,
    });

    if (!created) return { success: false, error: 'No se pudo crear la clave' };

    revalidatePath('/settings/api');

    // The only time the secret exists outside the caller's machine. It is
    // returned once and never stored — only its digest went to the database.
    return { success: true, data: { id: created.id, key } };
  } catch (error) {
    console.error('[API keys] create failed:', error);
    return { success: false, error: 'No se pudo crear la clave' };
  }
}

export async function revokeApiKeyAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autenticado' };

    requireRole(session.user.role, CAN_MANAGE_KEYS);

    const validated = revokeApiKeySchema.safeParse({ id });
    if (!validated.success) return { success: false, error: 'Clave no válida' };

    const revoked = await apiKeyRepo.revoke(
      session.user.organizationId,
      validated.data.id,
    );
    if (!revoked) {
      return { success: false, error: 'Esa clave no existe o ya estaba revocada' };
    }

    revalidatePath('/settings/api');

    return { success: true, data: { id: revoked.id } };
  } catch (error) {
    console.error('[API keys] revoke failed:', error);
    return { success: false, error: 'No se pudo revocar la clave' };
  }
}
