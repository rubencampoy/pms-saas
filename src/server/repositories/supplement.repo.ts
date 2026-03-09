import { db } from '@/server/db';
import { supplements } from '@/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';

export const supplementRepo = {
  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.supplements.findMany({
      where: and(
        eq(supplements.organizationId, organizationId),
        eq(supplements.propertyId, propertyId),
      ),
      orderBy: [asc(supplements.name)],
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.supplements.findFirst({
      where: and(
        eq(supplements.organizationId, organizationId),
        eq(supplements.id, id),
      ),
    });
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      name: string;
      type: string;
      amount: string;
      taxRate?: string;
    },
  ) {
    const [supplement] = await db
      .insert(supplements)
      .values({ organizationId, ...data })
      .returning();
    return supplement!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      type: string;
      amount: string;
      taxRate: string;
      isActive: boolean;
    }>,
  ) {
    const [supplement] = await db
      .update(supplements)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(supplements.organizationId, organizationId),
          eq(supplements.id, id),
        ),
      )
      .returning();
    return supplement;
  },

  async delete(organizationId: string, id: string) {
    const [supplement] = await db
      .delete(supplements)
      .where(
        and(
          eq(supplements.organizationId, organizationId),
          eq(supplements.id, id),
        ),
      )
      .returning();
    return supplement;
  },
};
