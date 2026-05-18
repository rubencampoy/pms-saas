import { db } from '@/server/db';
import { properties, units } from '@/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export const propertyRepo = {
  async findAll(organizationId: string) {
    return db.query.properties.findMany({
      where: eq(properties.organizationId, organizationId),
      orderBy: properties.name,
    });
  },

  /**
   * List properties of an org with plan + max_units + current unit count.
   * Used by both admin (to manage limits) and customer (to see per-property usage).
   */
  async findWithStatsByOrg(organizationId: string) {
    return db
      .select({
        id: properties.id,
        name: properties.name,
        code: properties.code,
        plan: properties.plan,
        maxUnits: properties.maxUnits,
        isActive: properties.isActive,
        createdAt: properties.createdAt,
        unitCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${units}
          WHERE ${units.propertyId} = ${properties.id}
        )`,
      })
      .from(properties)
      .where(eq(properties.organizationId, organizationId))
      .orderBy(properties.name);
  },

  async findById(organizationId: string, id: string) {
    return db.query.properties.findFirst({
      where: and(
        eq(properties.organizationId, organizationId),
        eq(properties.id, id),
      ),
    });
  },

  async create(
    organizationId: string,
    data: {
      name: string;
      code: string;
      address?: Record<string, string>;
      phone?: string;
      email?: string;
      checkInTime?: string;
      checkOutTime?: string;
      timezone?: string;
      plan?: string;
      maxUnits?: number;
    },
  ) {
    const [property] = await db
      .insert(properties)
      .values({
        organizationId,
        ...data,
      })
      .returning();
    return property!;
  },

  async updateLimits(
    propertyId: string,
    data: { plan: string; maxUnits: number },
  ) {
    const [property] = await db
      .update(properties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(properties.id, propertyId))
      .returning();
    return property;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      code: string;
      address: Record<string, string>;
      phone: string;
      email: string;
      checkInTime: string;
      checkOutTime: string;
      timezone: string;
      isActive: boolean;
    }>,
  ) {
    const [property] = await db
      .update(properties)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(properties.organizationId, organizationId),
          eq(properties.id, id),
        ),
      )
      .returning();
    return property;
  },

  async delete(organizationId: string, id: string) {
    const [property] = await db
      .delete(properties)
      .where(
        and(
          eq(properties.organizationId, organizationId),
          eq(properties.id, id),
        ),
      )
      .returning();
    return property;
  },
};
