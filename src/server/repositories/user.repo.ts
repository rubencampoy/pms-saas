import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';

export const userRepo = {
  async findAll(organizationId: string) {
    return db.query.users.findMany({
      where: and(
        eq(users.organizationId, organizationId),
        eq(users.isActive, true),
      ),
      orderBy: [asc(users.name)],
    });
  },

  async findByRole(organizationId: string, role: string) {
    return db.query.users.findMany({
      where: and(
        eq(users.organizationId, organizationId),
        eq(users.role, role),
        eq(users.isActive, true),
      ),
      orderBy: [asc(users.name)],
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.users.findFirst({
      where: and(
        eq(users.organizationId, organizationId),
        eq(users.id, id),
      ),
    });
  },
};
