import { headers } from 'next/headers';
import { propertyRepo } from '@/server/repositories/property.repo';
import { isIpAllowed } from './ip';

/** Best-effort public client IP from common proxy headers. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 45);
  return h.get('x-real-ip')?.slice(0, 45) ?? null;
}

export interface IpAccessResult {
  /** Whether the request is permitted to reach the internal PMS. */
  allowed: boolean;
  /** The resolved client IP (for display on the access-denied screen). */
  clientIp: string | null;
  /** Whether any property in the org has IP restriction enabled. */
  restricted: boolean;
}

/**
 * Evaluate per-property IP access for the active organization.
 *
 * Model: if no property has restriction enabled, access is open. If at least
 * one property has it enabled, the client IP must match the union of allowed
 * IPs across all enabled properties.
 */
export async function evaluateIpAccess(organizationId: string): Promise<IpAccessResult> {
  const settings = await propertyRepo.findIpSettingsByOrg(organizationId);
  const clientIp = await getClientIp();

  const enabled = settings.filter((p) => p.ipRestrictionEnabled);
  if (enabled.length === 0) {
    return { allowed: true, clientIp, restricted: false };
  }

  const allowList = enabled.flatMap((p) => p.allowedIps ?? []);
  return { allowed: isIpAllowed(clientIp, allowList), clientIp, restricted: true };
}
