import { db } from '@/server/db';
import { roomTypes } from '@/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';

export const roomTypeRepo = {
  async findAll(organizationId: string) {
    return db.query.roomTypes.findMany({
      where: eq(roomTypes.organizationId, organizationId),
      orderBy: [asc(roomTypes.sortOrder), asc(roomTypes.name)],
    });
  },

  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.roomTypes.findMany({
      where: and(
        eq(roomTypes.organizationId, organizationId),
        eq(roomTypes.propertyId, propertyId),
      ),
      orderBy: [asc(roomTypes.sortOrder), asc(roomTypes.name)],
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.roomTypes.findFirst({
      where: and(
        eq(roomTypes.organizationId, organizationId),
        eq(roomTypes.id, id),
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
      baseOccupancy: number;
      maxOccupancy: number;
      amenities?: string[];
      sortOrder?: number;
    },
  ) {
    const [roomType] = await db
      .insert(roomTypes)
      .values({
        organizationId,
        ...data,
      })
      .returning();
    return roomType!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      code: string;
      description: string;
      baseOccupancy: number;
      maxOccupancy: number;
      amenities: string[];
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const [roomType] = await db
      .update(roomTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(roomTypes.organizationId, organizationId),
          eq(roomTypes.id, id),
        ),
      )
      .returning();
    return roomType;
  },

  async delete(organizationId: string, id: string) {
    const [roomType] = await db
      .delete(roomTypes)
      .where(
        and(
          eq(roomTypes.organizationId, organizationId),
          eq(roomTypes.id, id),
        ),
      )
      .returning();
    return roomType;
  },
};
