import { organizationRepo } from '@/server/repositories/organization.repo';

export type LimitResource = 'property' | 'unit' | 'user';

const RESOURCE_LABELS: Record<LimitResource, string> = {
  property: 'propiedades',
  unit: 'habitaciones',
  user: 'usuarios',
};

/**
 * Check whether the organization can create one more of the given resource.
 * Returns { ok: true } if there's headroom, { ok: false, message } if the
 * plan limit would be exceeded.
 *
 * Counts pending invitations as users-in-flight, so an invitation cannot
 * bypass the user limit even before being accepted.
 */
export async function assertCapacity(
  organizationId: string,
  resource: LimitResource,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [org, usage] = await Promise.all([
    organizationRepo.findById(organizationId),
    organizationRepo.getUsage(organizationId),
  ]);

  if (!org) return { ok: false, message: 'Organización no encontrada' };

  const max =
    resource === 'property' ? org.maxProperties :
    resource === 'unit' ? org.maxUnits :
    org.maxUsers;
  const current =
    resource === 'property' ? usage.properties :
    resource === 'unit' ? usage.units :
    usage.users;

  if (current >= max) {
    return {
      ok: false,
      message: `Has alcanzado el límite de tu plan (${current} de ${max} ${RESOURCE_LABELS[resource]}). Contacta para ampliar.`,
    };
  }

  return { ok: true };
}
