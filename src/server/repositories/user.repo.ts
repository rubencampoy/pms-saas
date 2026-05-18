import { db } from '@/server/db';
import { users, memberships } from '@/server/db/schema';
import { and, eq, asc, isNotNull } from 'drizzle-orm';

const memberFields = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  role: memberships.role,
  isActive: users.isActive,
} as const;

export const userRepo = {
  async findAll(organizationId: string) {
    return db
      .select(memberFields)
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.isActive, true),
          isNotNull(memberships.acceptedAt),
          eq(users.isActive, true),
        ),
      )
      .orderBy(asc(users.name));
  },

  async findByRole(organizationId: string, role: string) {
    return db
      .select(memberFields)
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.role, role),
          eq(memberships.isActive, true),
          isNotNull(memberships.acceptedAt),
          eq(users.isActive, true),
        ),
      )
      .orderBy(asc(users.name));
  },

  async findById(organizationId: string, id: string) {
    const [row] = await db
      .select(memberFields)
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(users.id, id),
          eq(memberships.isActive, true),
        ),
      )
      .limit(1);
    return row;
  },
};
