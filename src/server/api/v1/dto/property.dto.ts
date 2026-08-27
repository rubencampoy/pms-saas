import type { properties } from '@/server/db/schema';

type PropertyRow = typeof properties.$inferSelect;

export interface PropertyAddressDto {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

/**
 * The public shape of a property.
 *
 * Deliberately withheld:
 *
 *   - `organizationId`          the caller is already scoped to it
 *   - `plan`, `maxUnits`        commercial/billing data, not guest-facing
 *   - `ipRestrictionEnabled`    security configuration — describing the PMS's
 *   - `allowedIps`              own access controls to an external consumer
 *                               only helps an attacker
 */
export interface PropertyDto {
  id: string;
  name: string;
  code: string;
  address: PropertyAddressDto;
  phone: string | null;
  email: string | null;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  isActive: boolean;
}

export function toPropertyDto(row: PropertyRow): PropertyDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: toAddressDto(row.address),
    phone: row.phone,
    email: row.email,
    checkInTime: row.checkInTime,
    checkOutTime: row.checkOutTime,
    timezone: row.timezone,
    isActive: row.isActive,
  };
}

/**
 * `properties.address` is untyped jsonb, so it is normalised field by field
 * rather than passed through — an unexpected key written by some other path
 * must not reach an external consumer.
 */
function toAddressDto(value: unknown): PropertyAddressDto {
  const source = (value ?? {}) as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof source[key] === 'string' ? (source[key] as string) : null;

  return {
    street: str('street'),
    city: str('city'),
    state: str('state'),
    postalCode: str('postalCode'),
    country: str('country'),
  };
}
