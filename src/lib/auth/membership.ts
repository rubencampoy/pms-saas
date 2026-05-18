import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { memberships } from '@/server/db/schema';
import { ForbiddenError } from '@/lib/errors';
import { ROLE_HIERARCHY, UserRole } from '@/lib/constants/roles';

/**
 * Verify that a user has an active accepted membership in an organization.
 * Optionally enforces a minimum role level.
 * Throws ForbiddenError if not satisfied.
 */
export async function assertActiveMembership(
  userId: string,
  organizationId: string,
  minRole?: UserRole,
): Promise<{ role: string }> {
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.isActive, true),
      isNotNull(memberships.acceptedAt),
    ),
  });

  if (!membership) {
    throw new ForbiddenError(
      `User has no active membership in organization ${organizationId}`,
    );
  }

  if (minRole) {
    const userLevel = ROLE_HIERARCHY[membership.role as UserRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole];
    if (userLevel < requiredLevel) {
      throw new ForbiddenError(
        `Insufficient role: has '${membership.role}', requires '${minRole}' or higher`,
      );
    }
  }

  return { role: membership.role };
}
