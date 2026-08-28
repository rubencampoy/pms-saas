import type { units } from '@/server/db/schema';

type UnitRow = typeof units.$inferSelect;

/**
 * The public shape of a unit — the physical room or apartment a reservation
 * was assigned to.
 *
 * It exists so an integration can say *which* room the guest is in: the
 * reservation already carries `unitId`, but a UUID cannot be matched against
 * a door lock or printed on a key card. Withheld on purpose:
 *
 *   - `status`, `housekeepingStatus`  operational state of the PMS floor,
 *                                     not something an outside product acts on
 *   - `notes`                         staff-only free text
 *   - `isActive`, `sortOrder`         inventory bookkeeping
 *   - `organizationId`                the caller is already scoped to it
 *
 * No extra scope gates this expansion: `reservations:read` already exposes
 * `unitId`, and a unit's name carries no personal data. The scopes that gate
 * the other expansions protect *other* resources — guest identity, folio
 * money — and there is no `units:read` scope to require.
 */
export interface UnitDto {
  id: string;
  name: string;
  floor: string | null;
}

export function toUnitDto(row: UnitRow): UnitDto {
  return {
    id: row.id,
    name: row.name,
    floor: row.floor,
  };
}
