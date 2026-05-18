import { db } from '@/server/db';
import {
  organizations,
  memberships,
  invitations,
  properties,
  units,
} from '@/server/db/schema';
import { eq, desc, sql, and, isNull, gt } from 'drizzle-orm';

export const organizationRepo = {
  async findAll() {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
  },

  async findById(id: string) {
    return db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  },

  async findBySlug(slug: string) {
    return db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
      columns: { id: true },
    });
  },

  /**
   * List all orgs with member counts + pending invitation counts.
   * Used by the super-admin platform panel.
   */
  async findAllWithStats() {
    return db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        plan: organizations.plan,
        status: organizations.status,
        maxProperties: organizations.maxProperties,
        maxUnits: organizations.maxUnits,
        maxUsers: organizations.maxUsers,
        createdAt: organizations.createdAt,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${memberships}
          WHERE ${memberships.organizationId} = ${organizations.id}
            AND ${memberships.isActive} = true
            AND ${memberships.acceptedAt} IS NOT NULL
        )`,
        pendingInviteCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${invitations}
          WHERE ${invitations.organizationId} = ${organizations.id}
            AND ${invitations.acceptedAt} IS NULL
            AND ${invitations.revokedAt} IS NULL
            AND ${invitations.expiresAt} > NOW()
        )`,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt));
  },

  /**
   * Returns current usage counts for an org. Used both for admin overview
   * and customer-facing usage banner.
   */
  async getUsage(organizationId: string) {
    const [propertyCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(properties)
      .where(eq(properties.organizationId, organizationId));

    const [unitCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(units)
      .where(eq(units.organizationId, organizationId));

    const [activeMemberCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.isActive, true),
        ),
      );

    const [pendingInviteCount] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      );

    return {
      properties: propertyCount?.n ?? 0,
      units: unitCount?.n ?? 0,
      // count pending invites as users-in-flight to avoid bypassing limits
      users: (activeMemberCount?.n ?? 0) + (pendingInviteCount?.n ?? 0),
    };
  },
};
