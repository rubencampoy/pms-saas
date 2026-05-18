import { db } from '@/server/db';
import { invitations, organizations } from '@/server/db/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';

export const invitationRepo = {
  async findByToken(token: string) {
    const [row] = await db
      .select({
        id: invitations.id,
        organizationId: invitations.organizationId,
        organizationName: organizations.name,
        email: invitations.email,
        role: invitations.role,
        invitedByUserId: invitations.invitedByUserId,
        token: invitations.token,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        revokedAt: invitations.revokedAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
      .where(eq(invitations.token, token))
      .limit(1);
    return row;
  },

  async findPendingByOrg(organizationId: string) {
    return db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .orderBy(desc(invitations.createdAt));
  },

  async create(values: {
    organizationId: string;
    email: string;
    role: string;
    invitedByUserId: string;
    token: string;
    expiresAt: Date;
  }) {
    const [row] = await db.insert(invitations).values(values).returning();
    return row;
  },

  async markAccepted(id: string) {
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, id));
  },

  async revoke(id: string, organizationId: string) {
    const result = await db
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.id, id),
          eq(invitations.organizationId, organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .returning({ id: invitations.id });
    return result.length > 0;
  },
};
