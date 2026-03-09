import { db } from '@/server/db';
import { ratePlans } from '@/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';

export const ratePlanRepo = {
  async findAll(organizationId: string) {
    return db.query.ratePlans.findMany({
      where: eq(ratePlans.organizationId, organizationId),
      orderBy: [asc(ratePlans.priority), asc(ratePlans.name)],
    });
  },

  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.ratePlans.findMany({
      where: and(
        eq(ratePlans.organizationId, organizationId),
        eq(ratePlans.propertyId, propertyId),
      ),
      orderBy: [asc(ratePlans.priority), asc(ratePlans.name)],
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.ratePlans.findFirst({
      where: and(
        eq(ratePlans.organizationId, organizationId),
        eq(ratePlans.id, id),
      ),
    });
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      name: string;
      code: string;
      description?: string;
      cancellationPolicy?: string;
      cancellationHours?: number;
      priority?: number;
    },
  ) {
    const [ratePlan] = await db
      .insert(ratePlans)
      .values({ organizationId, ...data })
      .returning();
    return ratePlan!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      code: string;
      description: string;
      cancellationPolicy: string;
      cancellationHours: number;
      isActive: boolean;
      priority: number;
    }>,
  ) {
    const [ratePlan] = await db
      .update(ratePlans)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(ratePlans.organizationId, organizationId),
          eq(ratePlans.id, id),
        ),
      )
      .returning();
    return ratePlan;
  },

  async delete(organizationId: string, id: string) {
    const [ratePlan] = await db
      .delete(ratePlans)
      .where(
        and(
          eq(ratePlans.organizationId, organizationId),
          eq(ratePlans.id, id),
        ),
      )
      .returning();
    return ratePlan;
  },
};
