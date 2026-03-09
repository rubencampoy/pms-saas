import { db } from '@/server/db';
import { properties } from '@/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const propertyRepo = {
  async findAll(organizationId: string) {
    return db.query.properties.findMany({
      where: eq(properties.organizationId, organizationId),
      orderBy: properties.name,
    });
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
