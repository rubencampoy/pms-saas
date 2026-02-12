import { UserRole, ROLE_HIERARCHY } from '@/lib/constants/roles';
import { ForbiddenError } from '@/lib/errors';

/**
 * Check if a user role has sufficient privileges.
 * Throws ForbiddenError if the user's role is not in the allowed list.
 */
export function requireRole(userRole: string, allowedRoles: string[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError(
      `Role '${userRole}' is not authorized. Required: ${allowedRoles.join(', ')}`,
    );
  }
}

/**
 * Check if a user role meets or exceeds a minimum role level.
 * Uses the numeric hierarchy defined in ROLE_HIERARCHY.
 */
export function requireMinRole(userRole: string, minRole: UserRole): void {
  const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < requiredLevel) {
    throw new ForbiddenError(
      `Insufficient role level. Required: ${minRole} or higher.`,
    );
  }
}

/**
 * Check if a role has at least the given level (non-throwing version).
 */
export function hasMinRole(userRole: string, minRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];
  return userLevel >= requiredLevel;
}
