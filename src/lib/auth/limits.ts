import { organizationRepo } from '@/server/repositories/organization.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { db } from '@/server/db';
import { units } from '@/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export type OrgLimitResource = 'property' | 'user';

const ORG_RESOURCE_LABELS: Record<OrgLimitResource, string> = {
  property: 'propiedades',
  user: 'usuarios',
};

/**
 * Check whether the organization can create one more property or user.
 * Returns { ok: true } if there's headroom, { ok: false, message } if the
 * org-level plan limit would be exceeded.
 */
export async function assertOrgCapacity(
  organizationId: string,
  resource: OrgLimitResource,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [org, usage] = await Promise.all([
    organizationRepo.findById(organizationId),
    organizationRepo.getUsage(organizationId),
  ]);

  if (!org) return { ok: false, message: 'Organización no encontrada' };

  const max = resource === 'property' ? org.maxProperties : org.maxUsers;
  const current = resource === 'property' ? usage.properties : usage.users;

  if (current >= max) {
    return {
      ok: false,
      message: `Has alcanzado el límite de tu plan (${current} de ${max} ${ORG_RESOURCE_LABELS[resource]}). Contacta para ampliar.`,
    };
  }

  return { ok: true };
}

/**
 * Check whether a property can accept one more unit (room) based on the
 * per-property max_units configured by the platform admin.
 */
export async function assertPropertyUnitCapacity(
  organizationId: string,
  propertyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const property = await propertyRepo.findById(organizationId, propertyId);
  if (!property) return { ok: false, message: 'Propiedad no encontrada' };

  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(units)
    .where(eq(units.propertyId, propertyId));

  const current = row?.n ?? 0;
  if (current >= property.maxUnits) {
    return {
      ok: false,
      message: `${property.name} ha alcanzado el límite del plan (${current} de ${property.maxUnits} habitaciones). Contacta para ampliar.`,
    };
  }
  return { ok: true };
}
