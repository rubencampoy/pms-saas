import { db } from '@/server/db';
import { organizations, memberships, invitations } from '@/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const organizationRepo = {
  async findAll() {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
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
};
